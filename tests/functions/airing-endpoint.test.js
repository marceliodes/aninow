import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestGet } from '../../functions/api/airing.js';
import { rawAnime } from '../fixtures.js';

const paged = data => new Response(JSON.stringify({ data, pagination: { has_next_page: false } }), {
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
  const response = await withFetch(async url => paged(String(url).includes('/seasons/now') ? [rawAnime()] : []), () =>
    onRequestGet({ request: new Request('http://localhost:4174/api/airing') })
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
    onRequestGet({ request: new Request('http://localhost:4174/api/airing') })
  );
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).data, []);
});

test('airing Pages Function returns readable JSON when Jikan is unavailable', async () => {
  const response = await withFetch(async () => new Response(JSON.stringify({ status: 504 }), { status: 504, headers: { 'content-type': 'application/json' } }), () =>
    onRequestGet({ request: new Request('http://localhost:4174/api/airing') })
  );
  const payload = await response.json();
  assert.equal(response.status, 503);
  assert.equal(payload.error.code, 'UPSTREAM_UNAVAILABLE');
  assert.equal(payload.error.retryable, true);
});
