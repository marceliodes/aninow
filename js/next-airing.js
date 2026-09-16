const MINUTE_MS = 60_000;
const DAY_MINUTES = 24 * 60;
const MAX_TIMEOUT_MS = 2_147_000_000;

function nowValue(now) {
  const value = typeof now === 'function' ? now() : now;
  return value instanceof Date ? value.getTime() : Number(value ?? Date.now());
}

function parsedEvent(item, now) {
  if (item?.airing !== true) return null;
  const episode = item?.nextEpisodeNumber;
  const aired = item?.airedEpisodes;
  const target = Date.parse(item?.nextAiringAt);
  const current = nowValue(now);
  if (!Number.isInteger(episode) || episode <= 0 || aired !== episode - 1 || !Number.isFinite(target) || !Number.isFinite(current) || target <= current) return null;
  if (item.episodes != null && (!Number.isInteger(item.episodes) || episode > item.episodes)) return null;
  return { episode, aired, target, current };
}

export function countdownText(target, now = Date.now()) {
  const targetTime = target instanceof Date ? target.getTime() : typeof target === 'string' ? Date.parse(target) : Number(target);
  const remaining = targetTime - nowValue(now);
  if (!Number.isFinite(remaining) || remaining <= 0) return null;
  let minutes = Math.max(1, Math.ceil(remaining / MINUTE_MS));
  const days = Math.floor(minutes / DAY_MINUTES);
  minutes -= days * DAY_MINUTES;
  const hours = Math.floor(minutes / 60);
  minutes -= hours * 60;
  const parts = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes || !parts.length) parts.push(`${minutes}m`);
  return `in ${parts.join(' ')}`;
}

export function nextAiringInfo(item, { now = Date.now(), locale, timeZone } = {}) {
  const event = parsedEvent(item, now);
  if (!event) return null;
  let exactTime;
  try {
    exactTime = new Intl.DateTimeFormat(locale, {
      ...(timeZone ? { timeZone } : {}),
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    }).format(new Date(event.target));
  } catch {
    return null;
  }
  return {
    episodeLabel: `Next episode ${event.episode}`,
    exactTime,
    countdown: countdownText(event.target, event.current),
    progress: item.episodes == null ? `${event.aired} aired` : `${event.aired} of ${item.episodes} aired`,
    timestamp: new Date(event.target).toISOString()
  };
}

export function updateNextAiringCountdowns(root = document, now = Date.now()) {
  let expired = false;
  for (const element of root.querySelectorAll('[data-next-airing-at]')) {
    const countdown = countdownText(element.dataset.nextAiringAt, now);
    if (!countdown) {
      element.hidden = true;
      expired = true;
      continue;
    }
    const output = element.querySelector('[data-next-countdown]');
    if (output) output.textContent = countdown;
  }
  return expired;
}

export function watchNextAirings(root = document, { onExpire, now = () => Date.now(), intervalMs = MINUTE_MS } = {}) {
  let notified = false;
  let expiryTimer;
  const check = () => {
    const expired = updateNextAiringCountdowns(root, now);
    if (expired && !notified) {
      notified = true;
      onExpire?.();
    }
  };
  check();
  const interval = setInterval(check, intervalMs);
  const targets = [...root.querySelectorAll('[data-next-airing-at]')]
    .map(element => Date.parse(element.dataset.nextAiringAt))
    .filter(Number.isFinite);
  if (targets.length) {
    const delay = Math.max(0, Math.min(...targets) - nowValue(now) + 50);
    expiryTimer = setTimeout(check, Math.min(delay, MAX_TIMEOUT_MS));
  }
  return () => {
    clearInterval(interval);
    clearTimeout(expiryTimer);
  };
}
