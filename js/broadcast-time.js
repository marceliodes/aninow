const SOURCE_TIME_ZONE = 'Asia/Tokyo';
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_INDEX = new Map(DAYS.map((day, index) => [day.toLowerCase(), index]));
const UNKNOWN_BROADCAST = Object.freeze({ day: 'Unknown', time: 'TBA', sortKey: Number.POSITIVE_INFINITY });

function normalizedDay(value) {
  if (typeof value !== 'string') return null;
  const singular = value.trim().toLowerCase().replace(/s$/, '');
  const index = DAY_INDEX.get(singular);
  return index == null ? null : { index, label: DAYS[index] };
}

function validTime(value) {
  return typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function formatterOptions(timeZone, options) {
  return timeZone ? { ...options, timeZone } : options;
}

function dateParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', formatterOptions(timeZone, {
    calendar: 'gregory',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    weekday: 'long'
  })).formatToParts(date);
  return Object.fromEntries(parts.map(part => [part.type, part.value]));
}

function timeParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', formatterOptions(timeZone, {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  })).formatToParts(date);
  return Object.fromEntries(parts.map(part => [part.type, part.value]));
}

function usableTimeZone(timeZone) {
  if (timeZone == null || timeZone === '') return null;
  if (typeof timeZone !== 'string') return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format();
    return timeZone;
  } catch {
    return false;
  }
}

export function detectVisitorTimeZone() {
  try {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return usableTimeZone(timeZone) || null;
  } catch {
    return null;
  }
}

export function localBroadcast(item, options = {}) {
  const sourceDay = normalizedDay(item?.broadcastDay);
  if (!sourceDay || !validTime(item?.broadcastTime) || item?.broadcastTimezone !== SOURCE_TIME_ZONE) {
    return { ...UNKNOWN_BROADCAST };
  }

  const visitorTimeZone = Object.hasOwn(options, 'timeZone') ? usableTimeZone(options.timeZone) : detectVisitorTimeZone();
  if (visitorTimeZone === false) return { ...UNKNOWN_BROADCAST };

  const now = options.now instanceof Date ? options.now : new Date(options.now ?? Date.now());
  if (Number.isNaN(now.getTime())) return { ...UNKNOWN_BROADCAST };

  try {
    const currentJst = dateParts(now, SOURCE_TIME_ZONE);
    const currentDay = normalizedDay(currentJst.weekday);
    if (!currentDay) return { ...UNKNOWN_BROADCAST };

    const [hour, minute] = item.broadcastTime.split(':').map(Number);
    const dayOffset = sourceDay.index - currentDay.index;
    const instant = new Date(Date.UTC(
      Number(currentJst.year),
      Number(currentJst.month) - 1,
      Number(currentJst.day) + dayOffset,
      hour - 9,
      minute
    ));
    const localDate = dateParts(instant, visitorTimeZone);
    const localDay = normalizedDay(localDate.weekday);
    const localTime = timeParts(instant, visitorTimeZone);
    if (!localDay || !/^\d{2}$/.test(localTime.hour || '') || !/^\d{2}$/.test(localTime.minute || '')) {
      return { ...UNKNOWN_BROADCAST };
    }

    const displayTime = new Intl.DateTimeFormat(options.locale, formatterOptions(visitorTimeZone, {
      hour: 'numeric',
      minute: '2-digit'
    })).format(instant);
    return {
      day: localDay.label,
      time: displayTime,
      sortKey: localDay.index * 1440 + Number(localTime.hour) * 60 + Number(localTime.minute)
    };
  } catch {
    return { ...UNKNOWN_BROADCAST };
  }
}

