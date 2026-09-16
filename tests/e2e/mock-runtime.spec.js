import { test, expect } from '@playwright/test';

test('development fixture mode drives rankings, filters, sorting, and Load More', async ({ page }) => {
  await page.route('https://cdn.myanimelist.net/**', route => route.abort());
  await page.goto('/');
  await expect(page.locator('#result-count')).toHaveText('27 ranked · 3 unranked');
  await expect(page.locator('.featured-card')).toHaveCount(3);
  await expect(page.locator('#ranking-list .rank-row')).toHaveCount(17);
  await expect(page.getByText('Comet Post Office')).toBeVisible();
  await expect(page.locator('.row-next-airing').first()).toContainText(/Next episode \d+/);
  await expect(page.locator('.row-next-airing').first()).not.toContainText(/\d+s/);

  await page.getByRole('button', { name: 'Load 20 more' }).click();
  await expect(page.locator('#ranking-list .rank-row')).toHaveCount(24);
  await expect(page.getByRole('button', { name: 'Load 20 more' })).toBeHidden();

  await expect(page.getByLabel('Type')).toHaveCount(0);
  await page.getByLabel('Genre').selectOption('Action');
  await expect(page.locator('#featured')).toBeHidden();
  await expect(page.locator('#result-count')).toContainText('ranked');
  await page.getByRole('button', { name: 'Reset' }).click();
  await page.getByLabel('Search AniNow').fill('Karakuri Tanuki');
  await expect(page.getByText('The Clockwork Tanuki')).toBeVisible();
  await page.getByRole('button', { name: 'Reset' }).click();
  await page.getByLabel('Sort by').selectOption('title');
  await expect(page.locator('#ranking-list .rank-title a').first()).toHaveText('After-School Kaiju Club');
});

test('development fixture schedule links to a full fixture detail', async ({ page }) => {
  await page.route('https://cdn.myanimelist.net/**', route => route.abort());
  await page.goto('/schedule');
  for (const day of ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday','Unknown']) {
    await expect(page.getByRole('heading', { name: day })).toBeVisible();
  }
  const enrichedEntry = page.locator('.schedule-entry[href="/anime?id=900001"]');
  await expect(enrichedEntry.locator('.schedule-time')).toContainText('Regular');
  await expect(enrichedEntry.locator('.schedule-next-airing')).toContainText(/Next episode \d+/);
  await enrichedEntry.click();
  await expect(page.locator('#anime-detail')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('.detail-synopsis')).toContainText('development fixture content');
  await expect(page.locator('.rank-stat')).toContainText(/#\d+/);
  await expect(page.locator('.detail-next-airing')).toContainText('Exact event');
  await expect(page.locator('.fact').filter({ hasText: 'Regular broadcast' })).toBeVisible();
});
