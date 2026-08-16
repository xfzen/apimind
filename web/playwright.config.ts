import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  testIgnore: ['live-auth.spec.ts'],
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['line'], ['html', { open: 'never' }]] : 'line',
  use: {
    baseURL: 'http://127.0.0.1:4100',
    trace: 'retain-on-failure'
  },
  webServer: [
    {
      command: 'npm run dev:vite -- --force',
      url: 'http://127.0.0.1:4100',
      reuseExistingServer: false,
      env: {
        YAPI_WEB_HOST: '127.0.0.1',
        YAPI_WEB_PORT: '4100',
        YAPI_API_TARGET: 'http://127.0.0.1:9',
        VITE_CACHE_DIR: 'node_modules/.vite-playwright',
        VITE_OPEN: 'false'
      }
    },
    {
      command: 'npm run dev:chrome-cdp',
      url: 'http://127.0.0.1:19222/json/version',
      reuseExistingServer: true
    }
  ]
});
