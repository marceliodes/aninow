import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestGet as detailEndpoint } from '../../functions/api/anime/[id].js';
import { onRequestGet as airingEndpoint } from '../../functions/api/airing.js';
import { onRequestGet as scheduleEndpoint } from '../../functions/api/schedule.js';
import { errorResponse } from '../../functions/_lib/http.js';
import { malList, rawAnime } from '../fixtures.js';

class MemoryCache {
  constructor() { this.items = new Map(); }
  async match(request) { return this.items.get(request.url)?.clone(); }
  async put(request, response) { this.items.set(request.url, response.clone()); }
}

test('detail endpoint rejects invalid IDs without contacting upstream', async () => {
  const response = await detailEndpoint({ request: new Request('https://aninow.test/api/anime/nope'), params: { id: '-1' } });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: { code: 'INVALID_ID', message: 'Anime ID must be a positive integer.', retryable: false } });
});

test('structured upstream errors distinguish retryable and missing resources', async () => {
  const missing = errorResponse(Object.assign(new Error('Missing'), { status: 404 }));
  assert.equal((await missing.json()).error.retryable, false);
  const failed = errorResponse(Object.assign(new Error('Unavailable'), { status: 503 }));
  assert.equal((await failed.json()).error.retryable, true);
});

test('schedule reuses the cached airing refresh and preserves its freshness metadata', async () => {
  const originalFetch = globalThis.fetch;
  const originalCaches = globalThis.caches;
  let upstreamCalls = 0;
  globalThis.caches = { default: new MemoryCache() };
  globalThis.fetch = async url => {
    upstreamCalls += 1;
    const nodes = String(url).includes('/anime/ranking') ? [rawAnime()] : [];
    return new Response(JSON.stringify(malList(nodes)), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try {
    const context = { env: { MAL_CLIENT_ID: 'client-id' } };
    const airing = await airingEndpoint({ ...context, request: new Request('https://aninow.test/api/airing') });
    const airingPayload = await airing.json();
    assert.equal(upstreamCalls, 3);
    const schedule = await scheduleEndpoint({ ...context, request: new Request('https://aninow.test/api/schedule') });
    const schedulePayload = await schedule.json();
    assert.equal(upstreamCalls, 3);
    assert.deepEqual(schedulePayload.meta, airingPayload.meta);
    assert.equal(schedulePayload.data[0].rank, null);
    assert.equal(airingPayload.data[0].rank, 1);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalCaches === undefined) delete globalThis.caches;
    else globalThis.caches = originalCaches;
  }
});
