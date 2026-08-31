import test from 'node:test';
import assert from 'node:assert/strict';
import { baseEligible, canonicalize, eligibility, normalizeAnime } from '../../functions/_lib/normalize.js';
import { rawAnime } from '../fixtures.js';

const now = new Date('2026-08-30T12:00:00.000Z');

test('normalizes factual fields and score zero as unranked', () => {
  const item = normalizeAnime(rawAnime({ score: 0, scored_by: null }), { now });
  assert.equal(item.score, null);
  assert.equal(item.scoredBy, null);
  assert.equal(item.title, 'English One');
  assert.deepEqual(item.genres, ['Drama']);
});

test('excludes movies, Rx, and explicit adult genres', () => {
  assert.equal(baseEligible(rawAnime({ type: 'Movie' })), false);
  assert.equal(baseEligible(rawAnime({ rating: 'Rx - Hentai' })), false);
  assert.equal(baseEligible(rawAnime({ genres: [{ name: 'Hentai' }] })), false);
  assert.equal(baseEligible(rawAnime({ rating: 'R+ - Mild Nudity' })), true);
});

test('includes finished entries at the inclusive 14-day UTC boundary', () => {
  const boundary = rawAnime({ airing: false, status: 'Finished Airing', aired: { from: '2026-06-01T00:00:00Z', to: '2026-08-16T12:00:00Z' } });
  assert.equal(eligibility(boundary, now).eligible, true);
  assert.equal(eligibility(boundary, new Date(now.getTime() + 1)).eligible, false);
});

test('excludes finished entries with unreliable dates', () => {
  assert.equal(eligibility(rawAnime({ airing: false, status: 'Finished Airing', aired: { to: null } }), now).eligible, false);
  assert.equal(eligibility(rawAnime({ airing: false, status: 'Finished Airing', aired: { to: '2026' } }), now).eligible, false);
});

test('deduplicates and assigns canonical rank with vote and title tie breaks', () => {
  const items = [
    normalizeAnime(rawAnime({ mal_id: 3, title_english: 'Zulu', score: 9, scored_by: 5 }), { now }),
    normalizeAnime(rawAnime({ mal_id: 2, title_english: 'Alpha', score: 9, scored_by: 5 }), { now }),
    normalizeAnime(rawAnime({ mal_id: 1, score: 9, scored_by: 10 }), { now }),
    normalizeAnime(rawAnime({ mal_id: 1, score: 1 }), { now }),
    normalizeAnime(rawAnime({ mal_id: 4, title_english: 'Unscored', score: 0 }), { now })
  ];
  const result = canonicalize(items);
  assert.deepEqual(result.map(item => item.malId), [1, 2, 3, 4]);
  assert.deepEqual(result.map(item => item.rank), [1, 2, 3, null]);
});
