import { test, expect } from '@playwright/test';

test('development fixture mode drives rankings, filters, sorting, and Load More', async ({ page }) => {
  await page.route('https://cdn.myanimelist.net/**', route => route.abort());
  await page.goto('/index.html');
  await expect(page.locator('#result-count')).toHaveText('27 ranked · 3 unranked');
  await expect(page.locator('.featured-card')).toHaveCount(3);
  await expect(page.locator('#ranking-list .rank-row')).toHaveCount(17);
  await expect(page.getByText('Comet Post Office')).toBeVisible();

  await page.getByRole('button', { name: 'Load 20 more' }).click();
  await expect(page.locator('#ranking-list .rank-row')).toHaveCount(24);
  await expect(page.getByRole('button', { name: 'Load 20 more' })).toBeHidden();

  await page.getByLabel('Type').selectOption('OVA');
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
  await page.goto('/schedule.html');
  for (const day of ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday','Unknown']) {
    await expect(page.getByRole('heading', { name: day })).toBeVisible();
  }
  await page.locator('.schedule-entry').first().click();
  await expect(page.locator('#anime-detail')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('.detail-synopsis')).toContainText('development fixture content');
  await expect(page.locator('.rank-stat')).toContainText(/#\d+/);
});
