import test from 'node:test';
import assert from 'node:assert/strict';
import { ANILIST_BATCH_SIZE, createAniListClient, fetchNextAirings } from '../../functions/_lib/anilist.js';
import { applyNextAirings, enrichWithNextAirings, nextAiringFreshMs, normalizeNextAiring } from '../../functions/_lib/airing-enrichment.js';
import { normalizedAnime } from '../fixtures.js';

const now = Date.parse('2026-09-16T00:00:00.000Z');
const airingAt = Math.floor((now + 3_600_000) / 1000);
const raw = (overrides = {}) => ({ idMal: 1, nextAiringEpisode: { episode: 6, airingAt }, ...overrides });

test('AniList client requests only bounded MAL-ID next-airing fields', async () => {
  let captured;
  const client = createAniListClient({ fetchImpl: async (url, init) => {
    captured = { url, init, body: JSON.parse(init.body) };
    return new Response(JSON.stringify({ data: { Page: { media: [raw()] } } }), { status: 200 });
  } });
  assert.deepEqual(await client.request([1]), [raw()]);
  assert.equal(captured.url, 'https://graphql.anilist.co');
  assert.equal(captured.init.method, 'POST');
  assert.deepEqual(captured.body.variables, { malIds: [1], perPage: 1 });
  assert.match(captured.body.query, /idMal_in/);
  assert.match(captured.body.query, /nextAiringEpisode/);
  for (const field of ['averageScore', 'title', 'genres', 'description', 'coverImage']) assert.doesNotMatch(captured.body.query, new RegExp(field));
});

test('AniList lookups use sequential batches of at most 50 IDs', async () => {
  const calls = [];
  const ids = Array.from({ length: ANILIST_BATCH_SIZE * 2 + 1 }, (_, index) => index + 1);
  const records = await fetchNextAirings(ids, { client: { request: async batch => { calls.push(batch); return batch.map(idMal => ({ idMal, nextAiringEpisode: null })); } } });
  assert.deepEqual(calls.map(batch => batch.length), [50, 50, 1]);
  assert.equal(records.length, ids.length);
});

test('AniList client does not retry rate limits or accept GraphQL errors', async () => {
  let calls = 0;
  const limited = createAniListClient({ fetchImpl: async () => { calls += 1; return new Response(JSON.stringify({ errors: [{ status: 429 }] }), { status: 429 }); } });
  await assert.rejects(limited.request([1]), error => error.status === 503);
  assert.equal(calls, 1);
  const graphError = createAniListClient({ fetchImpl: async () => new Response(JSON.stringify({ data: null, errors: [{ message: 'Unavailable' }] }), { status: 200 }) });
  await assert.rejects(graphError.request([1]), /incomplete response/);
});

test('next-airing normalization requires an exact MAL ID and a valid future event', () => {
  const item = normalizedAnime();
  assert.deepEqual(normalizeNextAiring(raw(), item, now), {
    nextEpisodeNumber: 6,
    nextAiringAt: '2026-09-16T01:00:00.000Z',
    airedEpisodes: 5
  });
  assert.equal(normalizeNextAiring(raw({ idMal: 2 }), item, now), null);
  assert.equal(normalizeNextAiring(raw({ nextAiringEpisode: null }), item, now), null);
  assert.equal(normalizeNextAiring(raw({ nextAiringEpisode: { episode: 0, airingAt } }), item, now), null);
  assert.equal(normalizeNextAiring(raw({ nextAiringEpisode: { episode: 6, airingAt: `${airingAt}` } }), item, now), null);
  assert.equal(normalizeNextAiring(raw({ nextAiringEpisode: { episode: 13, airingAt } }), item, now), null);
  assert.equal(normalizeNextAiring(raw({ nextAiringEpisode: { episode: 6, airingAt: Math.floor(now / 1000) } }), item, now), null);
  assert.equal(normalizeNextAiring(raw(), { ...item, airing: false }, now), null);
  assert.deepEqual(normalizeNextAiring(raw({ nextAiringEpisode: { episode: 40, airingAt } }), { ...item, episodes: null }, now)?.airedEpisodes, 39);
});

test('invalid AniList enrichment is discarded without changing MAL data', () => {
  const item = normalizedAnime({ title: 'MAL title', score: 8.7, episodes: 12 });
  const [result] = applyNextAirings([item], [raw({ nextAiringEpisode: { episode: 13, airingAt } })], now);
  assert.equal(result.title, 'MAL title');
  assert.equal(result.score, 8.7);
  assert.equal(result.episodes, 12);
  assert.equal(result.nextEpisodeNumber, null);
  assert.equal(result.nextAiringAt, null);
  assert.equal(result.airedEpisodes, null);
});

test('optional AniList failure silently returns MAL-only records', async () => {
  const item = normalizedAnime();
  const [result] = await enrichWithNextAirings([item], { now: () => now, client: { request: async () => { throw new Error('offline'); } } });
  assert.equal(result.malId, item.malId);
  assert.equal(result.title, item.title);
  assert.equal(result.nextEpisodeNumber, null);
});

test('supplemental cache freshness ends at the next event when it is sooner than 30 minutes', () => {
  assert.equal(nextAiringFreshMs([raw({ nextAiringEpisode: { episode: 6, airingAt: Math.floor((now + 90_000) / 1000) } })], now), 90_000);
  assert.equal(nextAiringFreshMs([raw()], now), 30 * 60_000);
  assert.equal(nextAiringFreshMs([], now), 30 * 60_000);
});
