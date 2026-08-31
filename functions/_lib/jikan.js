const BASE_URL = 'https://api.jikan.moe/v4';
const RETRYABLE = new Set([429, 500, 502, 503, 504]);

export class UpstreamError extends Error {
  constructor(message, status = 502) { super(message); this.name = 'UpstreamError'; this.status = status; }
}

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

export function createJikanClient({ fetchImpl = fetch, sleepImpl = wait, timeoutMs = 12000, paceMs = 350 } = {}) {
  let lastRequestAt = 0;
  async function request(path) {
    const delay = Math.max(0, paceMs - (Date.now() - lastRequestAt));
    if (delay) await sleepImpl(delay);
    lastRequestAt = Date.now();
    for (let attempt = 0; attempt < 2; attempt += 1) {
      let response;
      try {
        response = await fetchImpl(`${BASE_URL}${path}`, { headers: { Accept: 'application/json', 'User-Agent': 'AniNow/1.0' }, signal: AbortSignal.timeout(timeoutMs) });
      } catch (error) {
        if (attempt === 0) { await sleepImpl(250); continue; }
        throw new UpstreamError(error?.name === 'TimeoutError' ? 'Jikan took too long to respond.' : 'Jikan is temporarily unreachable.', 503);
      }
      if (response.ok) {
        let payload;
        try { payload = await response.json(); } catch { throw new UpstreamError('Jikan returned malformed JSON.'); }
        if (!payload || typeof payload !== 'object' || !('data' in payload)) throw new UpstreamError('Jikan returned an incomplete response.');
        return payload;
      }
      if (RETRYABLE.has(response.status) && attempt === 0) {
        const retryAfter = Number(response.headers.get('Retry-After'));
        await sleepImpl(Number.isFinite(retryAfter) ? Math.min(retryAfter * 1000, 5000) : 500);
        continue;
      }
      if (response.status === 404) throw new UpstreamError('The requested anime was not found.', 404);
      if (RETRYABLE.has(response.status)) throw new UpstreamError('Jikan is temporarily unavailable. AniNow will retry shortly.', 503);
      throw new UpstreamError('Jikan could not provide a complete response.', 502);
    }
    throw new UpstreamError('Jikan is temporarily unavailable.', 503);
  }
  return { request };
}

export async function fetchAllPages(client, initialPath, { stop } = {}) {
  const rows = [];
  for (let page = 1; page <= 100; page += 1) {
    const separator = initialPath.includes('?') ? '&' : '?';
    const payload = await client.request(`${initialPath}${separator}page=${page}&limit=25`);
    if (!Array.isArray(payload.data) || !payload.pagination || typeof payload.pagination.has_next_page !== 'boolean') throw new UpstreamError('Jikan returned malformed pagination data.');
    rows.push(...payload.data);
    if (stop?.(payload.data, page) || !payload.pagination.has_next_page) break;
  }
  return rows;
}
