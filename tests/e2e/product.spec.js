import { test, expect } from '@playwright/test';
import { dataset, detail, freshness, mockApis } from './helpers.js';

test.use({ timezoneId: 'America/Los_Angeles', locale: 'en-US' });

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
  for (const name of ['Genre', 'Airing day', 'Sort by']) {
    const select = page.getByLabel(name);
    await expect(select).toHaveJSProperty('tagName', 'SELECT');
    expect(await select.evaluate(element => getComputedStyle(element).appearance)).not.toBe('none');
  }
  await page.getByLabel('Genre').selectOption('Action');
  await expect(page.locator('#featured')).toBeHidden();
  await expect(page.locator('#ranking-list .rank-row')).toHaveCount(dataset.filter(x => x.genres.includes('Action') && x.score).length);
  await page.getByLabel('Search AniNow').fill('Romaji 06');
  await expect(page.locator('#ranking-list .rank-row')).toHaveCount(1);
  await page.getByRole('button', { name: 'Reset' }).click();
  await expect(page.locator('.featured-card')).toHaveCount(3);
  await expect(page.getByText('Quiet Unscored')).toBeVisible();
  await expect(page.locator('#ranking-list .rank-row').first()).toContainText('#4');
  await expect(page.getByRole('link', { name: 'Schedule' })).toHaveAttribute('href', '/schedule');
  await expect(page.getByRole('link', { name: 'About' }).first()).toHaveAttribute('href', '/about');
  expect(upstream).toEqual([]);
});

test('public pages expose unique metadata and canonical routes', async ({ page }) => {
  await mockApis(page);
  const pages = [
    ['/', 'AniNow | Airing Anime Rankings', 'https://ani-now.pages.dev/'],
    ['/schedule', 'AniNow | Weekly Anime Schedule', 'https://ani-now.pages.dev/schedule'],
    ['/about', 'About | AniNow', 'https://ani-now.pages.dev/about'],
    ['/privacy', 'Privacy | AniNow', 'https://ani-now.pages.dev/privacy']
  ];
  const descriptions = [];
  for (const [path, title, canonical] of pages) {
    await page.goto(path);
    await expect(page).toHaveTitle(title);
    const description = await page.locator('meta[name="description"]').getAttribute('content');
    expect(description?.length).toBeGreaterThanOrEqual(40);
    descriptions.push(description);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', canonical);
    await expect(page.locator('a[href$=".html"],a[href*=".html?"]')).toHaveCount(0);
  }
  expect(new Set(descriptions).size).toBe(descriptions.length);
});

test('anime detail metadata uses real data and canonicalizes the numeric ID', async ({ page }) => {
  await mockApis(page);
  await page.goto('/anime?id=1');
  await expect(page).toHaveTitle('Anime Title 01 | AniNow');
  const description = 'Anime Title 01: A current series used for deterministic browser testing.';
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', description);
  await expect(page.locator('meta[property="og:description"]')).toHaveAttribute('content', description);
  await expect(page.locator('meta[name="twitter:description"]')).toHaveAttribute('content', description);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://ani-now.pages.dev/anime?id=1');
  await expect(page.locator('.detail-cover img')).toHaveAttribute('alt', 'Cover art for Anime Title 01');
});

test('unknown routes keep the custom 404 response and permanent detail errors are noindex', async ({ page }) => {
  const response = await page.goto('/definitely-not-an-anime-page');
  expect(response?.status()).toBe(404);
  await expect(page).toHaveTitle('Page Not Found | AniNow');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
  await expect(page.getByRole('heading', { name: 'That episode isn’t here.' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Return to rankings' })).toHaveAttribute('href', '/');

  await page.goto('/anime?id=nope');
  await expect(page).toHaveTitle('Invalid Anime Link | AniNow');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);

  await page.route('**/api/anime/999', route => route.fulfill({
    status: 404,
    contentType: 'application/json',
    body: JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Anime unavailable.', retryable: false } })
  }));
  await page.goto('/anime?id=999');
  await expect(page).toHaveTitle('Anime Unavailable | AniNow');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
});

test('every rendered image has intentional alt semantics', async ({ page }) => {
  await mockApis(page);
  await page.goto('/');
  await expect(page.locator('.featured-card')).toHaveCount(3);
  expect(await page.locator('img').evaluateAll(images => images.every(image => image.hasAttribute('alt')))).toBe(true);
  await expect(page.locator('.featured-card img').first()).toHaveAttribute('alt', 'Cover art for Anime Title 01');
  await expect(page.locator('#ranking-list img').first()).toHaveAttribute('alt', '');
  await expect(page.locator('#ranking-list img').first().locator('xpath=ancestor::a')).toHaveAttribute('aria-hidden', 'true');

  await page.goto('/schedule');
  await expect(page.locator('.schedule-entry')).toHaveCount(6);
  expect(await page.locator('img').evaluateAll(images => images.every(image => image.hasAttribute('alt')))).toBe(true);
  await expect(page.locator('.schedule-entry img').first()).toHaveAttribute('alt', '');
  await expect(page.locator('.schedule-entry').first()).toContainText('Anime Title');
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

test('theme survives page navigation for the session', async ({ page }) => {
  await page.route('**/api/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: dataset, meta: freshness() }) }));
  await page.goto('/');
  const initial = await page.locator('html').getAttribute('data-theme');
  await page.getByRole('button', { name: /Use .* theme/ }).click();
  const changed = await page.locator('html').getAttribute('data-theme');
  expect(changed).not.toBe(initial);
  await page.getByRole('link', { name: 'Schedule' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', changed);
});

test('manual Refresh is absent on every page', async ({ page }) => {
  await mockApis(page);
  for (const path of ['/', '/schedule', '/anime?id=1', '/about', '/privacy', '/does-not-exist']) {
    await page.goto(path);
    await expect(page.getByRole('button', { name: 'Refresh', exact: true })).toHaveCount(0);
  }
});

test('freshness expiry automatically re-requests AniNow data', async ({ page }) => {
  let calls = 0;
  await page.route('**/api/airing', route => {
    calls += 1;
    const meta = calls === 1 ? freshness(false, 50) : freshness();
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: dataset, meta }) });
  });
  await page.goto('/');
  await expect(page.locator('.featured-card')).toHaveCount(3);
  await expect.poll(() => calls).toBeGreaterThan(1);
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
  await page.goto('/schedule');
  await expect(page.getByRole('heading', { name: 'The schedule missed its cue' })).toBeVisible();
  await expect(page.locator('#schedule-state')).not.toHaveClass(/compact/);
  await expect(page.locator('.schedule-entry')).toHaveCount(0);

  await page.goto('/anime?id=1');
  await expect(page.getByRole('heading', { name: 'Details could not load' })).toBeVisible();
  await expect(page.locator('#detail-state')).not.toHaveClass(/compact/);
  await expect(page.locator('#anime-detail')).toBeHidden();
});

test('rankings retain successful data when a later refresh fails', async ({ page }) => {
  let calls = 0;
  await page.route('**/api/airing', route => {
    calls += 1;
    if (calls > 1) return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: { message: 'Fixture refresh outage.', retryable: true } }) });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: dataset, meta: freshness(false, 50) }) });
  });
  await page.goto('/');
  await expect(page.locator('.featured-card')).toHaveCount(3);
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
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: dataset.slice(0, 6), meta: freshness(false, 50) }) });
  });
  await page.goto('/schedule');
  await expect(page.locator('.schedule-entry')).toHaveCount(6);
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
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: detail, meta: freshness(false, 50) }) });
  });
  await page.goto('/anime?id=1');
  await expect(page.getByRole('heading', { name: 'Anime Title 01' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Latest refresh failed' })).toBeVisible();
  await expect(page.getByText(/last successfully loaded anime details are still shown/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Anime Title 01' })).toBeVisible();
  await expect(page.getByText('Details could not load')).toBeHidden();
});

test('freshness timestamps remain visible without a countdown', async ({ page }) => {
  await mockApis(page);
  for (const path of ['/', '/schedule', '/anime?id=1']) {
    await page.goto(path);
    await expect(page.locator('#freshness-status')).toHaveText('Fresh AniNow dataset');
    await expect(page.locator('#last-updated')).toContainText('Updated');
    await expect(page.locator('#countdown')).toHaveCount(0);
  }
});

test('stale detail response labels freshness and keeps details usable', async ({ page }) => {
  await mockApis(page, { stale: true });
  await page.goto('/anime?id=1');
  await expect(page.locator('#freshness-status')).toHaveText('Stale data · retry scheduled');
  await expect(page.locator('.detail-kicker')).toContainText('Stale data');
  await expect(page.getByRole('heading', { name: 'Anime Title 01' })).toBeVisible();
});

test('schedule groups localized times and detail renders local facts and safe MAL link', async ({ page }) => {
  const midnightMonday = { ...dataset[0], broadcastDay: 'Mondays', broadcastTime: '00:30' };
  await mockApis(page, { schedule: [midnightMonday], stale: true });
  await page.goto('/schedule');
  await expect(page.locator('#timezone-label')).toHaveText('Times shown in your local timezone: America/Los_Angeles');
  const sunday = page.locator('.schedule-day').filter({ has: page.getByRole('heading', { name: 'Sunday', exact: true }) });
  await expect(sunday.locator('.schedule-entry')).toHaveCount(1);
  await expect(sunday.locator('.schedule-time')).toHaveText(/8:30\s*AM/i);
  await expect(page.getByText(/Stale data/)).toBeVisible();
  await page.locator('.schedule-entry').first().click();
  await expect(page.getByRole('heading', { name: 'Anime Title 01' })).toBeVisible();
  await expect(page.getByText('A current series used for deterministic browser testing.')).toBeVisible();
  await expect(page.locator('.fact').filter({ hasText: 'Broadcast' })).toContainText(/local time/);
  await expect(page.getByRole('link', { name: /View on MyAnimeList/ })).toHaveAttribute('href', /^https:\/\/myanimelist\.net\/anime\//);
});

test('privacy and shared navigation explain visitor-facing behavior and link to the repository', async ({ page }) => {
  await page.goto('/privacy');
  const main = page.locator('main');
  const text = await main.innerText();
  expect(text).toContain('AniNow does not collect, track, sell, or store personal information.');
  expect(text).toContain('Last updated: September 2026');
  for (const fact of ['no accounts', 'submission forms', 'advertising trackers', 'sessionStorage', 'current tab session', 'not sent to AniNow', 'server-side code', 'server-only Client ID', 'Cover images', 'directly from MyAnimeList’s image host', 'external title link', 'privacy practices apply']) {
    expect(text).toContain(fact);
  }
  const privacyContact = main.getByRole('link', { name: 'open an issue on GitHub' });
  await expect(privacyContact).toHaveAttribute('href', 'https://github.com/marceliodes/aninow/issues');
  await expect(privacyContact).toHaveAttribute('target', '_blank');
  await expect(privacyContact).toHaveAttribute('rel', 'noopener noreferrer');
  expect(text).not.toMatch(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i);
  await expect(page.locator('a[href^="mailto:"]')).toHaveCount(0);
  expect(text).not.toMatch(/V1 implementation|as shipped|should be revised/i);

  const primaryNavigation = page.getByRole('navigation', { name: 'Primary' });
  await expect(primaryNavigation.getByRole('link', { name: 'About' })).toHaveAttribute('href', '/about');

  const footer = page.getByRole('contentinfo');
  await expect(footer).toContainText('Anime data provided by MyAnimeList. AniNow is not affiliated with or endorsed by MyAnimeList.');
  await expect(footer.getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/privacy');
  const repositoryLink = footer.getByRole('link', { name: 'GitHub' });
  await expect(repositoryLink).toHaveAttribute('href', 'https://github.com/marceliodes/aninow');
  await expect(repositoryLink).toHaveAttribute('target', '_blank');
  await expect(repositoryLink).toHaveAttribute('rel', 'noopener noreferrer');
  await expect(footer.getByRole('link', { name: 'About' })).toHaveCount(0);
});

test('invalid detail ID and mobile layout avoid horizontal overflow', async ({ page }, testInfo) => {
  await page.goto('/anime?id=nope');
  await expect(page.getByText('Invalid anime link')).toBeVisible();
  if (testInfo.project.name === 'mobile') {
    await mockApis(page);
    await page.goto('/');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow).toBe(false);
  }
});
