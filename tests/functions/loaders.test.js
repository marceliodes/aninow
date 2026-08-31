import test from 'node:test';
import assert from 'node:assert/strict';
import { loadAiring, loadDetail, loadSchedule } from '../../functions/_lib/loaders.js';
import { createJikanClient } from '../../functions/_lib/jikan.js';
import { rawAnime } from '../fixtures.js';

const page = (data, next = false) => ({ data, pagination: { has_next_page: next } });

test('airing aggregation fetches all pages, deduplicates, and keeps recent finished', async () => {
  const calls = [];
  const client = { request: async path => {
    calls.push(path);
    if (path.includes('/seasons/now') && path.includes('page=1')) return page([rawAnime()], true);
    if (path.includes('/seasons/now')) return page([rawAnime({ mal_id: 2, title_english: 'Second' })]);
    return page([rawAnime({ mal_id: 3, title_english: 'Grace', airing: false, status: 'Finished Airing', aired: { from: '2026-06-01T00:00:00Z', to: '2026-08-25T00:00:00Z' } })]);
  } };
  const result = await loadAiring({ client, now: new Date('2026-08-30T12:00:00Z') });
  assert.deepEqual(result.map(x => x.malId), [1,3,2]);
  assert.equal(calls.length, 3);
});

test('schedule filters ineligible media and retains source timezone', async () => {
  const client = { request: async () => page([rawAnime(), rawAnime({ mal_id: 2, type: 'Movie' })]) };
  const result = await loadSchedule({ client });
  assert.equal(result.length, 1);
  assert.equal(result[0].broadcastTimezone, 'Asia/Tokyo');
});

test('detail adds best-effort rank and rejects outside-window media', async () => {
  const currentClient = { request: async () => ({ data: rawAnime() }) };
  assert.equal((await loadDetail(1, { client: currentClient, aniNowRank: 4 })).aniNowRank, 4);
  const oldClient = { request: async () => ({ data: rawAnime({ airing: false, status: 'Finished Airing', aired: { to: '2020-01-01T00:00:00Z' } }) }) };
  await assert.rejects(loadDetail(1, { client: oldClient, now: new Date('2026-08-30T00:00:00Z') }), { status: 404 });
});

test('Jikan client retries 429 using Retry-After and rejects malformed 200', async () => {
  let calls = 0; const sleeps = [];
  const client = createJikanClient({ paceMs: 0, sleepImpl: async ms => sleeps.push(ms), fetchImpl: async () => {
    calls += 1;
    if (calls === 1) return new Response('{}', { status: 429, headers: { 'Retry-After': '1' } });
    return new Response(JSON.stringify({ data: [] }), { status: 200 });
  } });
  assert.deepEqual(await client.request('/test'), { data: [] });
  assert.deepEqual(sleeps, [1000]);
  const malformed = createJikanClient({ paceMs: 0, fetchImpl: async () => new Response('{', { status: 200 }) });
  await assert.rejects(malformed.request('/test'), /malformed JSON/);
});

test('Jikan client maps an exhausted upstream 504 to a retryable service outage', async () => {
  let calls = 0;
  const client = createJikanClient({ paceMs: 0, sleepImpl: async () => {}, fetchImpl: async () => { calls += 1; return new Response('{}', { status: 504 }); } });
  await assert.rejects(client.request('/seasons/now'), error => error.status === 503 && /temporarily unavailable/.test(error.message));
  assert.equal(calls, 2);
});
