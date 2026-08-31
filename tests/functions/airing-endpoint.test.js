import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestGet } from '../../functions/api/airing.js';
import { malList, rawAnime } from '../fixtures.js';

const paged = data => new Response(JSON.stringify(malList(data)), {
  status: 200,
  headers: { 'content-type': 'application/json' }
});

async function withFetch(fetchImpl, callback) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = fetchImpl;
  try { return await callback(); }
  finally { globalThis.fetch = originalFetch; }
}

test('airing Pages Function returns normalized real-shape data as JSON', async () => {
  const response = await withFetch(async url => paged(String(url).includes('/anime/ranking') ? [rawAnime()] : []), () =>
    onRequestGet({ request: new Request('http://localhost:4174/api/airing'), env: { MAL_CLIENT_ID: 'client-id' } })
  );
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /^application\/json/);
  assert.equal(payload.data.length, 1);
  assert.equal(payload.data[0].title, 'English One');
  assert.equal(payload.data[0].rank, 1);
  assert.equal(payload.meta.stale, false);
});

test('airing Pages Function accepts a successful empty upstream dataset', async () => {
  const response = await withFetch(async () => paged([]), () =>
    onRequestGet({ request: new Request('http://localhost:4174/api/airing'), env: { MAL_CLIENT_ID: 'client-id' } })
  );
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).data, []);
});

test('airing Pages Function returns readable JSON when MyAnimeList is unavailable', async () => {
  const response = await withFetch(async () => new Response(JSON.stringify({ status: 504 }), { status: 504, headers: { 'content-type': 'application/json' } }), () =>
    onRequestGet({ request: new Request('http://localhost:4174/api/airing'), env: { MAL_CLIENT_ID: 'client-id' } })
  );
  const payload = await response.json();
  assert.equal(response.status, 503);
  assert.equal(payload.error.code, 'UPSTREAM_UNAVAILABLE');
  assert.equal(payload.error.retryable, true);
});

test('airing Pages Function rejects a missing server-side Client ID without contacting upstream', async () => {
  let called = false;
  const response = await withFetch(async () => { called = true; throw new Error('unexpected'); }, () =>
    onRequestGet({ request: new Request('http://localhost:4174/api/airing'), env: {} })
  );
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error.code, 'UPSTREAM_UNAVAILABLE');
  assert.equal(called, false);
});
