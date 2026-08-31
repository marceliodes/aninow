import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mockApis } from './helpers.js';

for (const path of ['/', '/schedule.html', '/anime.html?id=1', '/about.html', '/privacy.html', '/404.html']) {
  test(`axe and keyboard smoke: ${path}`, async ({ page }) => {
    await mockApis(page);
    await page.goto(path);
    await page.locator('[aria-busy="true"]').waitFor({ state: 'detached', timeout: 1000 }).catch(() => {});
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
    await page.keyboard.press('Tab');
    await expect(page.locator(':focus')).toBeVisible();
  });
}
