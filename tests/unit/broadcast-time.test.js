import test from 'node:test';
import assert from 'node:assert/strict';
import { localBroadcast } from '../../js/broadcast-time.js';
import { filterAnime } from '../../js/rankings-logic.js';

const now = new Date('2026-09-02T00:00:00.000Z');
const broadcast = (broadcastDay, broadcastTime, broadcastTimezone = 'Asia/Tokyo') => ({
  broadcastDay,
  broadcastTime,
  broadcastTimezone
});

test('converts JST broadcasts across midnight in both directions', () => {
  const previousLocalDay = localBroadcast(broadcast('Mondays', '00:30'), {
    now,
    timeZone: 'America/Los_Angeles',
    locale: 'en-US'
  });
  assert.equal(previousLocalDay.day, 'Sunday');
  assert.match(previousLocalDay.time, /8:30\s*AM/i);
  assert.equal(previousLocalDay.sortKey, 6 * 1440 + 8 * 60 + 30);

  const nextLocalDay = localBroadcast(broadcast('Sundays', '23:30'), {
    now,
    timeZone: 'Pacific/Kiritimati',
    locale: 'en-GB'
  });
  assert.equal(nextLocalDay.day, 'Monday');
  assert.equal(nextLocalDay.time, '4:30');
  assert.equal(nextLocalDay.sortKey, 4 * 60 + 30);
});

test('returns Unknown and TBA for incomplete or invalid broadcasts', () => {
  for (const item of [
    broadcast(null, '23:30'),
    broadcast('Fridays', null),
    broadcast('Funday', '23:30'),
    broadcast('Fridays', '24:00'),
    broadcast('Fridays', '23:30', 'UTC')
  ]) {
    assert.deepEqual(localBroadcast(item, { now, timeZone: 'UTC' }), {
      day: 'Unknown',
      time: 'TBA',
      sortKey: Number.POSITIVE_INFINITY
    });
  }
});

test('uses locale defaults for visible time instead of forcing hour12', () => {
  const item = broadcast('Mondays', '00:30');
  const us = localBroadcast(item, { now, timeZone: 'America/Los_Angeles', locale: 'en-US' });
  const gb = localBroadcast(item, { now, timeZone: 'America/Los_Angeles', locale: 'en-GB' });
  assert.match(us.time, /8:30\s*AM/i);
  assert.equal(gb.time, '8:30');
});

test('airing-day filtering uses the derived visitor-local day', () => {
  const item = {
    title: 'Midnight Show',
    titleRomaji: 'Mayonaka',
    genres: ['Drama'],
    localBroadcast: localBroadcast(broadcast('Mondays', '00:30'), {
      now,
      timeZone: 'America/Los_Angeles',
      locale: 'en-US'
    })
  };
  const filters = { search: '', genre: 'all', day: 'Sunday', sort: 'score' };
  assert.deepEqual(filterAnime([item], filters), [item]);
  assert.deepEqual(filterAnime([item], { ...filters, day: 'Monday' }), []);
});
