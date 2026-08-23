import { defineConfig } from '@playwright/test';

const baseURL = process.env.APIMIND_LIVE_BASE_URL;

if (!baseURL) {
  throw new Error('APIMIND_LIVE_BASE_URL is required for live browser verification');
}

export default defineConfig({
  testDir: './tests/browser',
  testMatch: ['live-*.spec.ts'],
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'line',
  use: {
    baseURL,
    trace: 'retain-on-failure'
  }
});
