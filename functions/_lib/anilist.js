const API_URL = 'https://graphql.anilist.co';

export const ANILIST_BATCH_SIZE = 50;
export const ANILIST_TIMEOUT_MS = 5000;

const NEXT_AIRING_QUERY = `
query NextAirings($malIds: [Int!]!, $perPage: Int!) {
  Page(page: 1, perPage: $perPage) {
    media(idMal_in: $malIds, type: ANIME) {
      idMal
      nextAiringEpisode {
        episode
        airingAt
      }
    }
  }
}`;

export class AniListError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.name = 'AniListError';
    this.status = status;
  }
}

export function createAniListClient({ fetchImpl = fetch, timeoutMs = ANILIST_TIMEOUT_MS } = {}) {
  async function request(malIds) {
    if (!Array.isArray(malIds) || malIds.length < 1 || malIds.length > ANILIST_BATCH_SIZE || malIds.some(id => !Number.isInteger(id) || id <= 0)) {
      throw new TypeError('AniList lookup requires 1 to 50 positive MAL IDs.');
    }

    let response;
    try {
      response = await fetchImpl(API_URL, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: NEXT_AIRING_QUERY, variables: { malIds, perPage: malIds.length } }),
        signal: AbortSignal.timeout(timeoutMs)
      });
    } catch (error) {
      const timedOut = error?.name === 'TimeoutError' || error?.name === 'AbortError';
      throw new AniListError(timedOut ? 'AniList took too long to respond.' : 'AniList is temporarily unreachable.', 503);
    }

    let payload;
    try { payload = await response.json(); }
    catch { throw new AniListError('AniList returned malformed JSON.'); }

    if (!response.ok) {
      const status = response.status === 429 || response.status >= 500 || response.status === 403 ? 503 : 502;
      throw new AniListError('AniList could not provide next-airing data.', status);
    }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload) || (Array.isArray(payload.errors) && payload.errors.length)) {
      throw new AniListError('AniList returned an incomplete response.');
    }
    const media = payload?.data?.Page?.media;
    if (!Array.isArray(media)) throw new AniListError('AniList returned malformed media data.');
    return media;
  }

  return { request };
}

export async function fetchNextAirings(malIds, { client, fetchImpl, timeoutMs } = {}) {
  const ids = [...new Set((malIds || []).filter(id => Number.isInteger(id) && id > 0))].sort((a, b) => a - b);
  if (!ids.length) return [];
  const aniList = client || createAniListClient({ fetchImpl, timeoutMs });
  const records = [];
  for (let offset = 0; offset < ids.length; offset += ANILIST_BATCH_SIZE) {
    records.push(...await aniList.request(ids.slice(offset, offset + ANILIST_BATCH_SIZE)));
  }
  return records;
}
