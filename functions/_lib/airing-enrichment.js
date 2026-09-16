import { cachedDataset, FRESH_MS } from './cache.js';
import { fetchNextAirings } from './anilist.js';

const emptyAiring = item => ({ ...item, nextEpisodeNumber: null, nextAiringAt: null, airedEpisodes: null });

function timeValue(now) {
  const value = typeof now === 'function' ? now() : now;
  return value instanceof Date ? value.getTime() : Number(value);
}

export function normalizeNextAiring(record, item, now = Date.now()) {
  if (!record || record.idMal !== item?.malId || !item.airing) return null;
  const episode = record?.nextAiringEpisode?.episode;
  const airingAt = record?.nextAiringEpisode?.airingAt;
  if (!Number.isInteger(episode) || episode <= 0 || !Number.isInteger(airingAt) || airingAt <= 0) return null;
  if (item.episodes != null && episode > item.episodes) return null;
  const airingTime = airingAt * 1000;
  const currentTime = timeValue(now);
  if (!Number.isFinite(airingTime) || !Number.isFinite(currentTime) || airingTime <= currentTime) return null;
  const airingDate = new Date(airingTime);
  if (Number.isNaN(airingDate.getTime())) return null;
  return {
    nextEpisodeNumber: episode,
    nextAiringAt: airingDate.toISOString(),
    airedEpisodes: episode - 1
  };
}

export function applyNextAirings(items, records, now = Date.now()) {
  const byMalId = new Map();
  for (const record of Array.isArray(records) ? records : []) {
    if (Number.isInteger(record?.idMal) && !byMalId.has(record.idMal)) byMalId.set(record.idMal, record);
  }
  return items.map(item => {
    const base = emptyAiring(item);
    const next = normalizeNextAiring(byMalId.get(item.malId), base, now);
    return next ? { ...base, ...next } : base;
  });
}

export function nextAiringFreshMs(records, timestamp) {
  const upcoming = (Array.isArray(records) ? records : [])
    .map(record => Number(record?.nextAiringEpisode?.airingAt) * 1000)
    .filter(value => Number.isFinite(value) && value > timestamp);
  if (!upcoming.length) return FRESH_MS;
  return Math.max(1000, Math.min(FRESH_MS, Math.min(...upcoming) - timestamp));
}

function fingerprint(ids) {
  let hash = 2166136261;
  for (const id of ids) {
    for (const character of `${id},`) {
      hash ^= character.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
  }
  return `${ids.length}-${(hash >>> 0).toString(36)}`;
}

export async function enrichWithNextAirings(items, { request, cache = globalThis.caches?.default, now = () => Date.now(), client, scope = 'airing' } = {}) {
  const base = items.map(emptyAiring);
  const ids = base.filter(item => item.airing).map(item => item.malId).sort((a, b) => a - b);
  if (!ids.length) return base;
  try {
    const payload = await cachedDataset({
      request,
      cache,
      now,
      name: `anilist-${scope}-${fingerprint(ids)}`,
      freshMs: nextAiringFreshMs,
      loader: () => fetchNextAirings(ids, { client })
    });
    return applyNextAirings(base, payload.data, now);
  } catch {
    return base;
  }
}
