import test from 'node:test';
import assert from 'node:assert/strict';
import { baseEligible, canonicalize, eligibility, normalizeAnime, reliableDate } from '../../functions/_lib/normalize.js';
import { rawAnime } from '../fixtures.js';

const now = new Date('2026-08-30T00:00:00.000Z');

test('normalizes MAL v2 fields, title fallback, dates, broadcast, and missing values', () => {
  const item = normalizeAnime(rawAnime({ mean: 0, num_scoring_users: null, popularity: 0, num_list_users: null }), { now });
  assert.equal(item.score, null);
  assert.equal(item.scoredBy, null);
  assert.equal(item.popularity, null);
  assert.equal(item.members, null);
  assert.equal(item.title, 'English One');
  assert.equal(item.titleRomaji, 'Romaji One');
  assert.equal(item.type, 'TV');
  assert.equal(item.status, 'Currently Airing');
  assert.equal(item.broadcastDay, 'Fridays');
  assert.equal(item.broadcastTimezone, 'Asia/Tokyo');
  assert.deepEqual(item.genres, ['Drama']);
  assert.equal(item.malUrl, 'https://myanimelist.net/anime/1');
  assert.equal(normalizeAnime(rawAnime({ alternative_titles: {} }), { now }).title, 'Romaji One');
  assert.equal(normalizeAnime(rawAnime({ broadcast: { day_of_the_week: 'other', start_time: null } }), { now }).broadcastDay, null);
  assert.equal(reliableDate('2026-02-30'), null);
  assert.equal(reliableDate('2026'), null);
});

test('excludes all non-TV media and explicit classifications without over-filtering mature TV', () => {
  for (const media_type of ['movie', 'ona', 'ova', 'special']) assert.equal(baseEligible(rawAnime({ media_type })), false);
  assert.equal(baseEligible(rawAnime({ nsfw: 'black' })), false);
  assert.equal(baseEligible(rawAnime({ rating: 'rx' })), false);
  assert.equal(baseEligible(rawAnime({ genres: [{ name: 'Hentai' }] })), false);
  assert.equal(baseEligible(rawAnime({ genres: [{ name: 'Erotica' }] })), false);
  assert.equal(baseEligible(rawAnime({ nsfw: 'gray', rating: 'r_plus' })), true);
});

test('includes finished entries at the exact inclusive 14-day UTC boundary', () => {
  const boundary = rawAnime({ status: 'finished_airing', end_date: '2026-08-16' });
  assert.equal(eligibility(boundary, now).eligible, true);
  assert.equal(eligibility(boundary, new Date(now.getTime() + 1)).eligible, false);
  assert.equal(eligibility(rawAnime({ status: 'finished_airing', end_date: null }), now).eligible, false);
  assert.equal(eligibility(rawAnime({ status: 'finished_airing', end_date: '2026' }), now).eligible, false);
});

test('canonicalizes deduplicated scores with voter/title ties and alphabetical unranked titles', () => {
  const items = [
    normalizeAnime(rawAnime({ id: 3, alternative_titles: { en: 'Zulu' }, mean: 9, num_scoring_users: 5 }), { now }),
    normalizeAnime(rawAnime({ id: 2, alternative_titles: { en: 'Alpha' }, mean: 9, num_scoring_users: 5 }), { now }),
    normalizeAnime(rawAnime({ id: 1, mean: 9, num_scoring_users: 10 }), { now }),
    normalizeAnime(rawAnime({ id: 1, mean: 1 }), { now }),
    normalizeAnime(rawAnime({ id: 5, alternative_titles: { en: 'Zulu Unscored' }, mean: 0 }), { now }),
    normalizeAnime(rawAnime({ id: 4, alternative_titles: { en: 'Alpha Unscored' }, mean: null }), { now })
  ];
  const result = canonicalize(items);
  assert.deepEqual(result.map(item => item.malId), [1, 2, 3, 4, 5]);
  assert.deepEqual(result.map(item => item.rank), [1, 2, 3, null, null]);
});

test('detail-only fields map synopsis and start season', () => {
  const item = normalizeAnime(rawAnime(), { now, detail: true });
  assert.equal(item.synopsis, 'A precise fixture synopsis.');
  assert.equal(item.season, 'summer');
  assert.equal(item.year, 2026);
});
