import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'mock-runtime.spec.js',
  fullyParallel: true,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL: 'http://127.0.0.1:4174',
    trace: 'retain-on-failure'
  },
  webServer: {
    command: 'npm run dev:mock',
    url: 'http://127.0.0.1:4174',
    reuseExistingServer: true,
    timeout: 120_000
  },
  projects: [
    { name: 'mock-desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mock-mobile', use: { ...devices['Pixel 5'] } }
  ]
});
