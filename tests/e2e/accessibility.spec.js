import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mockApis } from './helpers.js';

for (const path of ['/', '/schedule', '/anime?id=1', '/about', '/privacy', '/does-not-exist']) {
  test(`axe and keyboard smoke: ${path}`, async ({ page }) => {
    await mockApis(page);
    await page.goto(path);
    await page.locator('[aria-busy="true"]').waitFor({ state: 'detached', timeout: 5000 }).catch(() => {});
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
    await page.keyboard.press('Tab');
    await expect(page.locator(':focus')).toBeVisible();
  });
}
