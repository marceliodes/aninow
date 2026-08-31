const BASE_URL = 'https://api.myanimelist.net/v2';
const RETRYABLE = new Set([429, 500, 502, 503, 504]);
const PAGE_LIMIT = 100;
const MAX_PAGES = 100;

export class UpstreamError extends Error {
  constructor(message, status = 502) { super(message); this.name = 'UpstreamError'; this.status = status; }
}

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

function validatedClientId(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{8,128}$/.test(value)) {
    throw new UpstreamError('AniNow is missing a valid MyAnimeList Client ID.', 503);
  }
  return value;
}

function retryDelay(response) {
  const value = response.headers.get('Retry-After');
  if (!value) return 500;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, 5000);
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.min(Math.max(0, date - Date.now()), 5000) : 500;
}

export function createMalClient({ clientId, fetchImpl = fetch, sleepImpl = wait, timeoutMs = 12000 } = {}) {
  const credential = validatedClientId(clientId);
  async function request(path) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      let response;
      try {
        response = await fetchImpl(`${BASE_URL}${path}`, {
          headers: { Accept: 'application/json', 'X-MAL-CLIENT-ID': credential },
          signal: AbortSignal.timeout(timeoutMs)
        });
      } catch (error) {
        if (attempt === 0) { await sleepImpl(250); continue; }
        const timedOut = error?.name === 'TimeoutError' || error?.name === 'AbortError';
        throw new UpstreamError(timedOut ? 'MyAnimeList took too long to respond.' : 'MyAnimeList is temporarily unreachable.', 503);
      }
      if (response.ok) {
        let payload;
        try { payload = await response.json(); } catch { throw new UpstreamError('MyAnimeList returned malformed JSON.'); }
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new UpstreamError('MyAnimeList returned an incomplete response.');
        return payload;
      }
      if (RETRYABLE.has(response.status) && attempt === 0) { await sleepImpl(retryDelay(response)); continue; }
      if (response.status === 404) throw new UpstreamError('The requested anime was not found.', 404);
      if (response.status === 401 || response.status === 403) throw new UpstreamError('AniNow could not authenticate with MyAnimeList.', 503);
      if (RETRYABLE.has(response.status)) throw new UpstreamError('MyAnimeList is temporarily unavailable. AniNow will retry shortly.', 503);
      throw new UpstreamError('MyAnimeList could not provide a complete response.', 502);
    }
    throw new UpstreamError('MyAnimeList is temporarily unavailable.', 503);
  }
  return { request };
}

function withPage(path, offset) {
  const url = new URL(path, BASE_URL);
  url.searchParams.set('limit', String(PAGE_LIMIT));
  url.searchParams.set('offset', String(offset));
  return `${url.pathname}${url.search}`;
}

export async function fetchAllPages(client, path) {
  const rows = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const payload = await client.request(withPage(path, page * PAGE_LIMIT));
    if (!Array.isArray(payload.data) || !payload.paging || typeof payload.paging !== 'object' || Array.isArray(payload.paging)) throw new UpstreamError('MyAnimeList returned malformed pagination data.');
    if (payload.paging.next != null && (typeof payload.paging.next !== 'string' || !payload.paging.next)) throw new UpstreamError('MyAnimeList returned malformed pagination data.');
    for (const record of payload.data) {
      if (!record || typeof record !== 'object' || !record.node || typeof record.node !== 'object') throw new UpstreamError('MyAnimeList returned a malformed anime record.');
      rows.push(record.node);
    }
    if (payload.paging.next && payload.data.length === 0) throw new UpstreamError('MyAnimeList returned incomplete pagination data.');
    if (!payload.paging.next) return rows;
  }
  throw new UpstreamError('MyAnimeList pagination exceeded AniNow’s safety limit.');
}
