import test from 'node:test';
import assert from 'node:assert/strict';
import { filterAnime, isDefaultView, sortAnime } from '../../js/rankings-logic.js';
import { countdownText, fetchJson } from '../../js/app.js';

const items = [
  { title: 'Beta', titleRomaji: 'Bēta', score: 8, scoredBy: 100, popularity: 0, members: 30, airedFrom: null, type: 'TV', genres: ['Drama'], localBroadcast: { day: 'Friday' } },
  { title: 'Alpha', titleRomaji: 'Arufa', score: 7, scoredBy: 900, popularity: 5, members: 50, airedFrom: '2026-08-01T00:00:00Z', type: 'TV', genres: ['Action'], localBroadcast: { day: 'Unknown' } },
  { title: 'Gamma', titleRomaji: 'Ganma', score: 9, scoredBy: 10, popularity: null, members: 10, airedFrom: '2026-08-20T00:00:00Z', type: 'TV', genres: ['Drama'], localBroadcast: { day: 'Monday' } }
];

test('implements every alternative sort with invalid popularity last', () => {
  assert.deepEqual(sortAnime(items, 'score').map(x => x.title), ['Gamma','Beta','Alpha']);
  assert.deepEqual(sortAnime(items, 'popularity').map(x => x.title), ['Alpha','Gamma','Beta']);
  assert.deepEqual(sortAnime(items, 'members').map(x => x.title), ['Alpha','Beta','Gamma']);
  assert.deepEqual(sortAnime(items, 'newest').map(x => x.title), ['Gamma','Alpha','Beta']);
  assert.deepEqual(sortAnime(items, 'title').map(x => x.title), ['Alpha','Beta','Gamma']);
});

test('searches display and romaji titles and combines filters', () => {
  const filters = { search: 'gan', genre: 'Drama', day: 'Monday', sort: 'score' };
  assert.deepEqual(filterAnime(items, filters).map(x => x.title), ['Gamma']);
  assert.equal(isDefaultView({ search: '', genre: 'all', day: 'all', sort: 'score' }), true);
});

test('countdown derives from timestamps and clamps at zero', () => {
  assert.equal(countdownText('2026-08-30T12:02:05Z', Date.parse('2026-08-30T12:00:00Z')), '02:05');
  assert.equal(countdownText('2026-08-30T11:00:00Z', Date.parse('2026-08-30T12:00:00Z')), '00:00');
});

test('non-JSON API responses explain that Wrangler is required for local Pages Functions', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('<!doctype html>', { status: 404, headers: { 'content-type': 'text/html' } });
  try { await assert.rejects(fetchJson('/api/airing'), /Run the site with Wrangler/); }
  finally { globalThis.fetch = originalFetch; }
});
