import { normalizedAnime } from '../fixtures.js';

export function makeAnime(index, overrides = {}) {
  return normalizedAnime({
    malId: index,
    title: `Anime Title ${String(index).padStart(2, '0')}`,
    titleRomaji: `Anime Romaji ${String(index).padStart(2, '0')}`,
    rank: index,
    score: Math.max(6, 9.5 - index * .05),
    scoredBy: 50000 - index * 100,
    popularity: index,
    members: 100000 - index * 500,
    type: 'TV',
    genres: index % 2 ? ['Drama'] : ['Action'],
    broadcastDay: index % 2 ? 'Fridays' : 'Mondays',
    ...overrides
  });
}

export const dataset = [
  ...Array.from({ length: 25 }, (_, i) => makeAnime(i + 1)),
  makeAnime(31, { title: 'Quiet Unscored', titleRomaji: 'Shizuka', rank: null, score: null, scoredBy: null })
];

export const detail = {
  ...dataset[0], synopsis: 'A current series used for deterministic browser testing.', season: 'summer', year: 2026, aniNowRank: 1
};

export function freshness(stale = false, expiresIn = 30 * 60_000) {
  const now = Date.now();
  return { updatedAt: new Date(now).toISOString(), expiresAt: new Date(now + expiresIn).toISOString(), stale, ...(stale ? { retryAt: new Date(now + 5 * 60_000).toISOString() } : {}) };
}

export async function mockApis(page, { airing = dataset, schedule = dataset.slice(0, 6), detailData = detail, status = 200, stale = false } = {}) {
  await page.route('**/api/**', async route => {
    if (status !== 200) return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ error: { code: 'UPSTREAM_ERROR', message: 'Fixture outage.', retryable: true } }) });
    const url = route.request().url();
    const data = url.includes('/airing') ? airing : url.includes('/schedule') ? schedule : detailData;
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data, meta: freshness(stale) }) });
  });
}
