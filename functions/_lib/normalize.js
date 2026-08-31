export const GRACE_MS = 14 * 24 * 60 * 60 * 1000;

const hasNumericValue = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
const finitePositive = value => hasNumericValue(value) && Number(value) > 0 ? Number(value) : null;
const finiteNonNegative = value => hasNumericValue(value) && Number(value) >= 0 ? Number(value) : null;
const text = value => typeof value === 'string' && value.trim() ? value.trim() : null;
const names = value => Array.isArray(value) ? value.map(item => text(item?.name)).filter(Boolean) : [];
const WEEKDAYS = new Set(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']);

export function reliableDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const time = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(time)) return null;
  const normalized = new Date(time).toISOString();
  return normalized.slice(0, 10) === value ? normalized : null;
}

export function isAdult(anime) {
  return anime?.nsfw === 'black' || anime?.rating === 'rx' || names(anime?.genres).some(name => /^(Hentai|Erotica)$/i.test(name));
}

export function baseEligible(anime) { return Boolean(anime && anime.media_type === 'tv' && !isAdult(anime)); }

export function eligibility(anime, now = new Date()) {
  if (!baseEligible(anime)) return { eligible: false, graceEndsAt: null };
  if (anime.status === 'currently_airing') return { eligible: true, graceEndsAt: null };
  if (anime.status !== 'finished_airing') return { eligible: false, graceEndsAt: null };
  const airedTo = reliableDate(anime.end_date);
  if (!airedTo) return { eligible: false, graceEndsAt: null };
  const end = Date.parse(airedTo);
  const nowTime = now.getTime();
  const graceEnds = end + GRACE_MS;
  return { eligible: end <= nowTime && nowTime <= graceEnds, graceEndsAt: new Date(graceEnds).toISOString() };
}

function statusLabel(status) {
  if (status === 'currently_airing') return 'Currently Airing';
  if (status === 'finished_airing') return 'Finished Airing';
  if (status === 'not_yet_aired') return 'Not Yet Aired';
  return text(status)?.replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase()) || null;
}

function broadcastDay(day) {
  const value = text(day)?.toLowerCase();
  return value && WEEKDAYS.has(value) ? `${value[0].toUpperCase()}${value.slice(1)}s` : null;
}

export function normalizeAnime(anime, { now = new Date(), detail = false } = {}) {
  if (!anime || !Number.isInteger(anime.id) || anime.id <= 0) throw new TypeError('Malformed anime record');
  const romajiTitle = text(anime.title);
  const displayTitle = text(anime?.alternative_titles?.en) || romajiTitle;
  if (!displayTitle) throw new TypeError('Anime record has no title');
  const studios = names(anime.studios);
  const { graceEndsAt } = eligibility(anime, now);
  const normalized = {
    malId: anime.id,
    title: displayTitle,
    titleRomaji: romajiTitle || displayTitle,
    image: text(anime?.main_picture?.large) || text(anime?.main_picture?.medium),
    rank: null,
    score: finitePositive(anime.mean),
    scoredBy: finiteNonNegative(anime.num_scoring_users),
    popularity: finitePositive(anime.popularity),
    members: finiteNonNegative(anime.num_list_users),
    type: anime.media_type === 'tv' ? 'TV' : text(anime.media_type)?.toUpperCase() || null,
    studio: studios[0] || null,
    studios,
    episodes: finitePositive(anime.num_episodes),
    status: statusLabel(anime.status),
    airing: anime.status === 'currently_airing',
    airedFrom: reliableDate(anime.start_date),
    airedTo: reliableDate(anime.end_date),
    broadcastDay: broadcastDay(anime?.broadcast?.day_of_the_week),
    broadcastTime: text(anime?.broadcast?.start_time),
    broadcastTimezone: 'Asia/Tokyo',
    genres: [...new Set(names(anime.genres))],
    malUrl: `https://myanimelist.net/anime/${anime.id}`,
    graceEndsAt
  };
  if (detail) Object.assign(normalized, {
    synopsis: text(anime.synopsis),
    season: text(anime?.start_season?.season),
    year: finitePositive(anime?.start_season?.year),
    aniNowRank: null
  });
  return normalized;
}

export function canonicalize(records) {
  const unique = new Map();
  for (const record of records) if (!unique.has(record.malId)) unique.set(record.malId, record);
  const values = [...unique.values()];
  const ranked = values.filter(item => item.score != null).sort((a, b) => b.score - a.score || (b.scoredBy ?? 0) - (a.scoredBy ?? 0) || a.title.localeCompare(b.title, 'en', { sensitivity: 'base' }));
  ranked.forEach((item, index) => { item.rank = index + 1; });
  const unranked = values.filter(item => item.score == null).sort((a, b) => a.title.localeCompare(b.title, 'en', { sensitivity: 'base' }));
  return [...ranked, ...unranked];
}
