import test from 'node:test';
import assert from 'node:assert/strict';
import { isDevelopmentMockRequest } from '../../functions/_lib/development.js';
import { onRequestGet as getAiring } from '../../functions/api/airing.js';
import { onRequestGet as getSchedule } from '../../functions/api/schedule.js';
import { onRequestGet as getDetail } from '../../functions/api/anime/[id].js';

const localEnv = { ANINOW_DEV_MOCK: '1', CF_PAGES_BRANCH: 'local' };
const localRequest = path => new Request(`http://127.0.0.1:4174${path}`);

test('mock activation requires its binding, Wrangler local branch, and localhost', () => {
  assert.equal(isDevelopmentMockRequest(localRequest('/api/airing'), localEnv), true);
  assert.equal(isDevelopmentMockRequest(localRequest('/api/airing'), { ...localEnv, ANINOW_DEV_MOCK: undefined }), false);
  assert.equal(isDevelopmentMockRequest(localRequest('/api/airing'), { ...localEnv, CF_PAGES_BRANCH: 'main' }), false);
  assert.equal(isDevelopmentMockRequest(new Request('https://aninow.pages.dev/api/airing'), localEnv), false);
});

test('mock airing endpoint has enough normalized ranked, finished, and unranked entries', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('Mock mode must never contact Jikan'); };
  try {
    const response = await getAiring({ request: localRequest('/api/airing'), env: localEnv });
    const payload = await response.json();
    const ranked = payload.data.filter(item => item.rank !== null);
    const unranked = payload.data.filter(item => item.rank === null);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.ok(ranked.length > 20);
    assert.ok(unranked.length >= 3);
    assert.ok(payload.data.some(item => item.status === 'Finished Airing' && item.graceEndsAt));
    assert.deepEqual(ranked.map(item => item.rank), Array.from({ length: ranked.length }, (_, index) => index + 1));
    assert.deepEqual(Object.keys(payload.meta).sort(), ['expiresAt', 'stale', 'updatedAt']);
  } finally { globalThis.fetch = originalFetch; }
});

test('mock schedule covers every weekday and unknown broadcasts with the same response shape', async () => {
  const response = await getSchedule({ request: localRequest('/api/schedule'), env: localEnv });
  const payload = await response.json();
  const days = new Set(payload.data.map(item => item.broadcastDay?.replace(/s$/, '') || 'Unknown'));
  assert.deepEqual([...['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday','Unknown'].filter(day => !days.has(day))], []);
  assert.ok(payload.data.every(item => item.rank === null));
  assert.equal(payload.meta.stale, false);
});

test('mock detail endpoint returns full fixture details and a normal 404', async () => {
  const found = await getDetail({ request: localRequest('/api/anime/900001'), params: { id: '900001' }, env: localEnv });
  const payload = await found.json();
  assert.equal(found.status, 200);
  assert.match(payload.data.synopsis, /development fixture content/);
  assert.equal(payload.data.aniNowRank, 1);
  assert.ok(payload.data.year);

  const missing = await getDetail({ request: localRequest('/api/anime/999999'), params: { id: '999999' }, env: localEnv });
  assert.equal(missing.status, 404);
  assert.equal((await missing.json()).error.code, 'NOT_FOUND');
});

test('mock binding cannot activate on a production hostname', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ data: [], pagination: { has_next_page: false } }), { status: 200, headers: { 'content-type': 'application/json' } });
  try {
    const response = await getAiring({ request: new Request('https://aninow.pages.dev/api/airing'), env: localEnv });
    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.deepEqual(payload.data, []);
    assert.notEqual(response.headers.get('cache-control'), 'no-store');
  } finally { globalThis.fetch = originalFetch; }
});
