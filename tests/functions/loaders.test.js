import test from 'node:test';
import assert from 'node:assert/strict';
import { currentAndPreviousSeasons, DETAIL_FIELDS, loadAiring, loadDetail, loadSchedule, SUMMARY_FIELDS } from '../../functions/_lib/loaders.js';
import { createMalClient, fetchAllPages } from '../../functions/_lib/mal.js';
import { malList, rawAnime } from '../fixtures.js';

const now = new Date('2026-08-30T00:00:00Z');

test('airing discovery paginates ranking and seasons, merges recent finishes, and prefers ranking duplicates', async () => {
  const calls = [];
  const client = { request: async path => {
    calls.push(path);
    if (path.startsWith('/anime/ranking') && path.includes('offset=0')) return malList([
      rawAnime(),
      rawAnime({ id: 9, media_type: 'ona' }),
      rawAnime({ id: 8, status: 'finished_airing', end_date: '2026-08-29' })
    ], 'https://api.myanimelist.net/v2/anime/ranking?offset=100');
    if (path.startsWith('/anime/ranking')) return malList([rawAnime({ id: 2, alternative_titles: { en: 'Second' }, mean: 8 })]);
    if (path.includes('/anime/season/2026/summer')) return malList([
      rawAnime({ id: 3, alternative_titles: { en: 'Grace' }, mean: 9, status: 'finished_airing', end_date: '2026-08-25' }),
      rawAnime({ id: 1, alternative_titles: { en: 'Wrong duplicate' }, mean: 1, status: 'finished_airing', end_date: '2026-08-25' }),
      rawAnime({ id: 4, status: 'finished_airing', end_date: '2026-08-01' })
    ]);
    if (path.includes('/anime/season/2026/spring')) return malList([rawAnime({ id: 5, nsfw: 'black', status: 'finished_airing', end_date: '2026-08-25' })]);
    throw new Error(`Unexpected request: ${path}`);
  } };
  const result = await loadAiring({ client, now });
  assert.deepEqual(result.map(item => item.malId), [3, 1, 2]);
  assert.equal(result.find(item => item.malId === 1).title, 'English One');
  assert.equal(calls.length, 4);
  assert.ok(calls.every(path => path.includes('limit=100') && path.includes('fields=')));
  assert.ok(calls.some(path => path.includes('ranking_type=airing')));
  assert.ok(calls.some(path => path.includes('offset=100')));
});

test('calendar season calculation handles winter rollover', () => {
  assert.deepEqual(currentAndPreviousSeasons(new Date('2026-01-15T00:00:00Z')), [
    { year: 2026, season: 'winter' },
    { year: 2025, season: 'fall' }
  ]);
  assert.deepEqual(currentAndPreviousSeasons(new Date('2026-09-01T00:00:00Z')), [
    { year: 2026, season: 'summer' },
    { year: 2026, season: 'spring' }
  ]);
});

test('schedule is the rank-null projection of the same eligible dataset', async () => {
  const client = { request: async path => path.startsWith('/anime/ranking')
    ? malList([rawAnime()])
    : malList([]) };
  const result = await loadSchedule({ client, now });
  assert.equal(result.length, 1);
  assert.equal(result[0].rank, null);
  assert.equal(result[0].broadcastTimezone, 'Asia/Tokyo');
});

test('detail requests only the detail fields, adds rank, and rejects ineligible records', async () => {
  let path;
  const currentClient = { request: async value => { path = value; return rawAnime(); } };
  const item = await loadDetail(1, { client: currentClient, now, aniNowRank: 4 });
  assert.equal(item.aniNowRank, 4);
  assert.ok(path.startsWith('/anime/1?'));
  assert.ok(path.includes(encodeURIComponent('synopsis')));
  assert.ok(DETAIL_FIELDS.includes('start_season'));
  assert.ok(!SUMMARY_FIELDS.includes('synopsis'));
  const oldClient = { request: async () => rawAnime({ status: 'finished_airing', end_date: '2020-01-01' }) };
  await assert.rejects(loadDetail(1, { client: oldClient, now }), { status: 404 });
});

test('MAL client validates credentials, injects only the Client ID, and handles missing resources', async () => {
  assert.throws(() => createMalClient(), /Client ID/);
  assert.throws(() => createMalClient({ clientId: ' bad id ' }), /Client ID/);
  assert.throws(() => createMalClient({ clientId: 'short' }), /Client ID/);
  let request;
  const client = createMalClient({ clientId: 'client-id', fetchImpl: async (url, init) => {
    request = { url, init };
    return new Response(JSON.stringify({ id: 1 }), { status: 200 });
  } });
  assert.deepEqual(await client.request('/anime/1'), { id: 1 });
  assert.equal(request.url, 'https://api.myanimelist.net/v2/anime/1');
  assert.equal(request.init.headers['X-MAL-CLIENT-ID'], 'client-id');
  assert.equal(JSON.stringify(request).includes('secret'), false);
  const missing = createMalClient({ clientId: 'client-id', fetchImpl: async () => new Response('{}', { status: 404 }) });
  await assert.rejects(missing.request('/anime/404'), { status: 404 });
});

test('MAL client performs one bounded retry for throttling, transient failures, and timeouts', async () => {
  let calls = 0;
  const sleeps = [];
  const throttled = createMalClient({ clientId: 'client-id', sleepImpl: async ms => sleeps.push(ms), fetchImpl: async () => {
    calls += 1;
    if (calls === 1) return new Response('{}', { status: 429, headers: { 'Retry-After': '10' } });
    return new Response(JSON.stringify({ data: [] }), { status: 200 });
  } });
  assert.deepEqual(await throttled.request('/test'), { data: [] });
  assert.deepEqual(sleeps, [5000]);

  calls = 0;
  const unavailable = createMalClient({ clientId: 'client-id', sleepImpl: async () => {}, fetchImpl: async () => { calls += 1; return new Response('{}', { status: 504 }); } });
  await assert.rejects(unavailable.request('/test'), error => error.status === 503 && /temporarily unavailable/.test(error.message));
  assert.equal(calls, 2);

  calls = 0;
  const timeout = createMalClient({ clientId: 'client-id', sleepImpl: async () => {}, fetchImpl: async () => { calls += 1; throw new DOMException('Timed out', 'TimeoutError'); } });
  await assert.rejects(timeout.request('/test'), error => error.status === 503 && /too long/.test(error.message));
  assert.equal(calls, 2);
});

test('MAL client and paginator reject malformed JSON, paging, records, and partial pagination', async () => {
  const malformedJson = createMalClient({ clientId: 'client-id', fetchImpl: async () => new Response('{', { status: 200 }) });
  await assert.rejects(malformedJson.request('/test'), /malformed JSON/);
  await assert.rejects(fetchAllPages({ request: async () => ({ data: [] }) }, '/anime/ranking'), /pagination/);
  await assert.rejects(fetchAllPages({ request: async () => ({ data: [{}], paging: {} }) }, '/anime/ranking'), /anime record/);
  await assert.rejects(fetchAllPages({ request: async () => ({ data: [], paging: { next: true } }) }, '/anime/ranking'), /pagination/);
  await assert.rejects(fetchAllPages({ request: async () => ({ data: [], paging: { next: 'https://example.test/next' } }) }, '/anime/ranking'), /incomplete/);
});
