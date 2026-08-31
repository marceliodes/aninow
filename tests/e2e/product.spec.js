import { test, expect } from '@playwright/test';
import { dataset, detail, freshness, mockApis } from './helpers.js';

test('rankings controls, top-three behavior, load more, and links work', async ({ page }) => {
  const upstream = [];
  page.on('request', request => { if (request.url().includes('api.myanimelist.net')) upstream.push(request.url()); });
  await mockApis(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /What’s airing/ })).toBeVisible();
  await expect(page.locator('.featured-card')).toHaveCount(3);
  await expect(page.locator('#ranking-list .rank-row')).toHaveCount(17);
  await page.getByRole('button', { name: 'Load 20 more' }).click();
  await expect(page.locator('#ranking-list .rank-row')).toHaveCount(22);
  await expect(page.getByRole('button', { name: 'Load 20 more' })).toBeHidden();
  await expect(page.getByLabel('Type')).toHaveCount(0);
  await page.getByLabel('Genre').selectOption('Action');
  await expect(page.locator('#featured')).toBeHidden();
  await expect(page.locator('#ranking-list .rank-row')).toHaveCount(dataset.filter(x => x.genres.includes('Action') && x.score).length);
  await page.getByLabel('Search AniNow').fill('Romaji 06');
  await expect(page.locator('#ranking-list .rank-row')).toHaveCount(1);
  await page.getByRole('button', { name: 'Reset' }).click();
  await expect(page.locator('.featured-card')).toHaveCount(3);
  await expect(page.getByText('Quiet Unscored')).toBeVisible();
  await expect(page.locator('#ranking-list .rank-row').first()).toContainText('#4');
  await expect(page.getByRole('link', { name: 'Schedule' })).toHaveAttribute('href', '/schedule.html');
  await expect(page.getByRole('link', { name: 'About' }).first()).toHaveAttribute('href', '/about.html');
  expect(upstream).toEqual([]);
});

test('initial loading does not expose counts or Load More before success', async ({ page }) => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route('**/api/airing', async route => {
    await gate;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: dataset, meta: { updatedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 1800000).toISOString(), stale: false } }) });
  });
  await page.goto('/');
  await expect(page.locator('#ranking-list')).toHaveAttribute('aria-busy', 'true');
  await expect(page.locator('#result-count')).toHaveText('');
  await expect(page.getByRole('button', { name: 'Load 20 more' })).toBeHidden();
  release();
  await expect(page.locator('#result-count')).toContainText('25 ranked');
});

test('successful empty dataset has a distinct empty state and no Load More', async ({ page }) => {
  await mockApis(page, { airing: [] });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'No eligible titles right now' })).toBeVisible();
  await expect(page.locator('#result-count')).toHaveText('No eligible titles');
  await expect(page.getByRole('button', { name: 'Load 20 more' })).toBeHidden();
});

test('theme survives page navigation for the session and refresh re-requests AniNow', async ({ page }) => {
  let calls = 0;
  await page.route('**/api/**', route => { calls += 1; route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: dataset, meta: { updatedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 1800000).toISOString(), stale: false } }) }); });
  await page.goto('/');
  const initial = await page.locator('html').getAttribute('data-theme');
  await page.getByRole('button', { name: /Use .* theme/ }).click();
  const changed = await page.locator('html').getAttribute('data-theme');
  expect(changed).not.toBe(initial);
  await page.getByRole('link', { name: 'Schedule' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', changed);
  const before = calls;
  await page.getByRole('button', { name: 'Refresh' }).click();
  await expect.poll(() => calls).toBeGreaterThan(before);
});

test('friendly ranking error retries and empty filter state is useful', async ({ page }) => {
  let calls = 0;
  await page.route('**/api/airing', route => {
    calls += 1;
    if (calls === 1) return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: { message: 'Fixture outage.', retryable: true } }) });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: dataset, meta: { updatedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 1800000).toISOString(), stale: false } }) });
  });
  await page.goto('/');
  await expect(page.getByText('The rankings are taking a break')).toBeVisible();
  await expect(page.locator('#ranking-state')).not.toHaveClass(/compact/);
  await expect(page.locator('#result-count')).toHaveText('');
  await expect(page.getByRole('button', { name: 'Load 20 more' })).toBeHidden();
  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(page.locator('.featured-card')).toHaveCount(3);
  await page.getByLabel('Search AniNow').fill('not in the fixture');
  await expect(page.getByText('No titles match')).toBeVisible();
});

test('schedule and detail initial failures keep their full error states', async ({ page }) => {
  await page.route('**/api/**', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: { message: 'Fixture initial outage.', retryable: true } }) }));
  await page.goto('/schedule.html');
  await expect(page.getByRole('heading', { name: 'The schedule missed its cue' })).toBeVisible();
  await expect(page.locator('#schedule-state')).not.toHaveClass(/compact/);
  await expect(page.locator('.schedule-entry')).toHaveCount(0);

  await page.goto('/anime.html?id=1');
  await expect(page.getByRole('heading', { name: 'Details could not load' })).toBeVisible();
  await expect(page.locator('#detail-state')).not.toHaveClass(/compact/);
  await expect(page.locator('#anime-detail')).toBeHidden();
});

test('rankings retain successful data when a later refresh fails', async ({ page }) => {
  let calls = 0;
  await page.route('**/api/airing', route => {
    calls += 1;
    if (calls > 1) return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: { message: 'Fixture refresh outage.', retryable: true } }) });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: dataset, meta: freshness() }) });
  });
  await page.goto('/');
  await expect(page.locator('.featured-card')).toHaveCount(3);
  await page.getByRole('button', { name: 'Refresh' }).click();
  await expect(page.getByRole('heading', { name: 'Latest refresh failed' })).toBeVisible();
  await expect(page.getByText(/last successfully loaded rankings are still shown/)).toBeVisible();
  await expect(page.locator('#ranking-state')).toHaveClass(/compact/);
  await expect(page.locator('.featured-card')).toHaveCount(3);
  await expect(page.getByText('The rankings are taking a break')).toBeHidden();
});

test('schedule retains successful data when a later refresh fails', async ({ page }) => {
  let calls = 0;
  await page.route('**/api/schedule', route => {
    calls += 1;
    if (calls > 1) return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: { message: 'Fixture refresh outage.', retryable: true } }) });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: dataset.slice(0, 6), meta: freshness() }) });
  });
  await page.goto('/schedule.html');
  await expect(page.locator('.schedule-entry')).toHaveCount(6);
  await page.getByRole('button', { name: 'Refresh' }).click();
  await expect(page.getByRole('heading', { name: 'Latest refresh failed' })).toBeVisible();
  await expect(page.getByText(/last successfully loaded schedule is still shown/)).toBeVisible();
  await expect(page.locator('.schedule-entry')).toHaveCount(6);
  await expect(page.getByText('The schedule missed its cue')).toBeHidden();
});

test('detail retains successful data when a later refresh fails', async ({ page }) => {
  let calls = 0;
  await page.route('**/api/anime/1', route => {
    calls += 1;
    if (calls > 1) return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: { message: 'Fixture refresh outage.', retryable: true } }) });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: detail, meta: freshness() }) });
  });
  await page.goto('/anime.html?id=1');
  await expect(page.getByRole('heading', { name: 'Anime Title 01' })).toBeVisible();
  await page.getByRole('button', { name: 'Refresh' }).click();
  await expect(page.getByRole('heading', { name: 'Latest refresh failed' })).toBeVisible();
  await expect(page.getByText(/last successfully loaded anime details are still shown/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Anime Title 01' })).toBeVisible();
  await expect(page.getByText('Details could not load')).toBeHidden();
});

test('detail shows shared freshness timestamps and countdown', async ({ page }) => {
  await mockApis(page);
  await page.goto('/anime.html?id=1');
  await expect(page.locator('#freshness-status')).toHaveText('Fresh AniNow dataset');
  await expect(page.locator('#last-updated')).toContainText('Updated');
  await expect(page.locator('#countdown')).toHaveText(/^\d{2}:\d{2}$/);
  await expect(page.locator('#countdown')).not.toHaveText('--:--');
});

test('stale detail response labels freshness and keeps details usable', async ({ page }) => {
  await mockApis(page, { stale: true });
  await page.goto('/anime.html?id=1');
  await expect(page.locator('#freshness-status')).toHaveText('Stale data · retry scheduled');
  await expect(page.locator('.detail-kicker')).toContainText('Stale data');
  await expect(page.locator('#countdown')).toHaveText(/^\d{2}:\d{2}$/);
  await expect(page.getByRole('heading', { name: 'Anime Title 01' })).toBeVisible();
});

test('schedule groups source times and detail renders facts and safe MAL link', async ({ page }) => {
  await mockApis(page, { stale: true });
  await page.goto('/schedule.html');
  await expect(page.getByRole('heading', { name: 'Monday' })).toBeVisible();
  await expect(page.getByText('Source timezone: Asia/Tokyo')).toBeVisible();
  await expect(page.getByText(/Stale data/)).toBeVisible();
  await page.locator('.schedule-entry').first().click();
  await expect(page.getByRole('heading', { name: 'Anime Title 01' })).toBeVisible();
  await expect(page.getByText('A current series used for deterministic browser testing.')).toBeVisible();
  await expect(page.getByRole('link', { name: /View on MyAnimeList/ })).toHaveAttribute('href', /^https:\/\/myanimelist\.net\/anime\//);
});

test('invalid detail ID and mobile layout avoid horizontal overflow', async ({ page }, testInfo) => {
  await page.goto('/anime.html?id=nope');
  await expect(page.getByText('Invalid anime link')).toBeVisible();
  if (testInfo.project.name === 'mobile') {
    await mockApis(page);
    await page.goto('/');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow).toBe(false);
  }
});
