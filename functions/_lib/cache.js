const VERSION = 'providers-v2';
export const FRESH_MS = 30 * 60 * 1000;
export const STALE_MS = 24 * 60 * 60 * 1000;
export const RETRY_MS = 5 * 60 * 1000;
const inflight = new Map();

function key(origin, name, kind) { return new Request(`${origin}/__aninow-cache/${VERSION}/${name}/${kind}`); }
function response(value, ttlMs) { return new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json', 'cache-control': `public, max-age=${Math.max(1, Math.ceil(ttlMs / 1000))}` } }); }
async function read(cache, request) { const hit = await cache.match(request); if (!hit) return null; try { return await hit.json(); } catch { return null; } }
function duration(value, data, timestamp) {
  const result = typeof value === 'function' ? value(data, timestamp) : value;
  return Number.isFinite(result) && result > 0 ? result : FRESH_MS;
}

export async function readLastSuccess(name, request, cache = globalThis.caches?.default) {
  if (!cache) return null;
  return read(cache, key(new URL(request.url).origin, name, 'last-success'));
}

export async function cachedDataset({ request, name, loader, cache = globalThis.caches?.default, now = () => Date.now(), freshMs = FRESH_MS, staleMs = STALE_MS, retryMs = RETRY_MS }) {
  if (!cache) {
    const data = await loader();
    const updated = now();
    const freshFor = duration(freshMs, data, updated);
    return { data, meta: { updatedAt: new Date(updated).toISOString(), expiresAt: new Date(updated + freshFor).toISOString(), stale: false } };
  }
  const origin = new URL(request.url).origin;
  const freshKey = key(origin, name, 'fresh');
  const staleKey = key(origin, name, 'last-success');
  const failedKey = key(origin, name, 'failed');
  const fresh = await read(cache, freshKey);
  if (fresh) return fresh;
  const stale = await read(cache, staleKey);
  const failed = await read(cache, failedKey);
  if (failed && stale) return { data: stale.data, meta: { ...stale.meta, stale: true, retryAt: failed.retryAt } };
  if (failed) throw Object.assign(new Error(failed.message || 'AniNow is waiting before retrying the upstream source.'), { status: failed.status || 503 });
  if (inflight.has(name)) return inflight.get(name);
  const promise = (async () => {
    try {
      const data = await loader();
      const timestamp = now();
      const freshFor = duration(freshMs, data, timestamp);
      const payload = { data, meta: { updatedAt: new Date(timestamp).toISOString(), expiresAt: new Date(timestamp + freshFor).toISOString(), stale: false } };
      await Promise.all([cache.put(freshKey, response(payload, freshFor)), cache.put(staleKey, response(payload, staleMs))]);
      return payload;
    } catch (error) {
      const retryAt = new Date(now() + retryMs).toISOString();
      await cache.put(failedKey, response({ retryAt, message: error?.message, status: error?.status || 503 }, retryMs));
      if (stale) return { data: stale.data, meta: { ...stale.meta, stale: true, retryAt } };
      throw error;
    } finally { inflight.delete(name); }
  })();
  inflight.set(name, promise);
  return promise;
}

export function clearInflightForTests() { inflight.clear(); }
