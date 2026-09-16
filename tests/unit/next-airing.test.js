import test from 'node:test';
import assert from 'node:assert/strict';
import { countdownText, nextAiringInfo } from '../../js/next-airing.js';
import { normalizedAnime } from '../fixtures.js';

const now = Date.parse('2026-09-16T00:00:00.000Z');

test('episode countdown uses days, hours, and minutes without seconds', () => {
  assert.equal(countdownText(now + (2 * 24 * 60 + 4 * 60 + 3) * 60_000, now), 'in 2d 4h 3m');
  assert.equal(countdownText(now + 30_000, now), 'in 1m');
  assert.equal(countdownText(now, now), null);
  assert.doesNotMatch(countdownText(now + 65_000, now), /s/);
});

test('next-airing display keeps known and unknown totals honest', () => {
  const base = normalizedAnime({ nextEpisodeNumber: 6, airedEpisodes: 5, nextAiringAt: '2026-09-16T03:00:00.000Z' });
  const known = nextAiringInfo(base, { now, locale: 'en-US', timeZone: 'UTC' });
  assert.equal(known.episodeLabel, 'Next episode 6');
  assert.equal(known.progress, '5 of 12 aired');
  assert.equal(known.countdown, 'in 3h');
  const unknown = nextAiringInfo({ ...base, episodes: null }, { now, locale: 'en-US', timeZone: 'UTC' });
  assert.equal(unknown.progress, '5 aired');
  assert.equal(nextAiringInfo({ ...base, nextAiringAt: '2026-09-15T23:59:00.000Z' }, { now }), null);
  assert.equal(nextAiringInfo({ ...base, airing: false }, { now }), null);
});
