export const ALLOWED_TYPES = new Set(['TV', 'ONA', 'OVA']);
export const GRACE_MS = 14 * 24 * 60 * 60 * 1000;

const hasNumericValue = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
const finitePositive = value => hasNumericValue(value) && Number(value) > 0 ? Number(value) : null;
const finiteNonNegative = value => hasNumericValue(value) && Number(value) >= 0 ? Number(value) : null;
const text = value => typeof value === 'string' && value.trim() ? value.trim() : null;
const names = value => Array.isArray(value) ? value.map(item => text(item?.name)).filter(Boolean) : [];

export function reliableDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(value)) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

export function isAdult(anime) {
  return /^Rx\b/i.test(text(anime?.rating) || '') || [...names(anime?.genres), ...names(anime?.explicit_genres)].some(name => /^(Hentai|Erotica)$/i.test(name));
}

export function baseEligible(anime) {
  return anime && ALLOWED_TYPES.has(anime.type) && !isAdult(anime);
}

export function eligibility(anime, now = new Date()) {
  if (!baseEligible(anime)) return { eligible: false, graceEndsAt: null };
  if (anime.airing === true || anime.status === 'Currently Airing') return { eligible: true, graceEndsAt: null };
  if (anime.status !== 'Finished Airing') return { eligible: false, graceEndsAt: null };
  const airedTo = reliableDate(anime?.aired?.to);
  if (!airedTo) return { eligible: false, graceEndsAt: null };
  const end = new Date(airedTo).getTime();
  const nowTime = now.getTime();
  const graceEnds = end + GRACE_MS;
  return { eligible: end <= nowTime && nowTime <= graceEnds, graceEndsAt: new Date(graceEnds).toISOString() };
}

export function normalizeAnime(anime, { now = new Date(), detail = false } = {}) {
  if (!anime || !Number.isInteger(anime.mal_id) || anime.mal_id <= 0) throw new TypeError('Malformed anime record');
  const displayTitle = text(anime.title_english) || text(anime.title) || text(anime.title_japanese);
  if (!displayTitle) throw new TypeError('Anime record has no title');
  const status = text(anime.status);
  const { graceEndsAt } = eligibility(anime, now);
  const normalized = {
    malId: anime.mal_id,
    title: displayTitle,
    titleRomaji: text(anime.title) || displayTitle,
    image: text(anime?.images?.webp?.large_image_url) || text(anime?.images?.webp?.image_url) || text(anime?.images?.jpg?.large_image_url) || text(anime?.images?.jpg?.image_url),
    rank: null,
    score: finitePositive(anime.score),
    scoredBy: finiteNonNegative(anime.scored_by),
    popularity: finitePositive(anime.popularity),
    members: finiteNonNegative(anime.members),
    type: text(anime.type),
    studio: names(anime.studios)[0] || null,
    studios: names(anime.studios),
    episodes: finitePositive(anime.episodes),
    status,
    airing: anime.airing === true,
    airedFrom: reliableDate(anime?.aired?.from),
    airedTo: reliableDate(anime?.aired?.to),
    broadcastDay: text(anime?.broadcast?.day),
    broadcastTime: text(anime?.broadcast?.time),
    broadcastTimezone: text(anime?.broadcast?.timezone),
    genres: [...new Set([...names(anime.genres), ...names(anime.themes), ...names(anime.demographics)])],
    malUrl: text(anime.url),
    graceEndsAt
  };
  if (detail) Object.assign(normalized, {
    synopsis: text(anime.synopsis),
    season: text(anime.season),
    year: finitePositive(anime.year),
    aniNowRank: null
  });
  return normalized;
}

export function canonicalize(records) {
  const unique = new Map();
  for (const record of records) if (!unique.has(record.malId)) unique.set(record.malId, record);
  const values = [...unique.values()];
  const ranked = values.filter(item => item.score != null).sort((a, b) =>
    b.score - a.score || (b.scoredBy ?? 0) - (a.scoredBy ?? 0) || a.title.localeCompare(b.title, 'en', { sensitivity: 'base' })
  );
  ranked.forEach((item, index) => { item.rank = index + 1; });
  const unranked = values.filter(item => item.score == null).sort((a, b) => a.title.localeCompare(b.title, 'en', { sensitivity: 'base' }));
  return [...ranked, ...unranked];
}
