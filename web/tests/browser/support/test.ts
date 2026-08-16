import { expect, test as base } from '@playwright/test';

const cdpEndpoint = process.env.PLAYWRIGHT_CDP_ENDPOINT ?? 'http://127.0.0.1:19222';

export const test = base.extend({
  browser: async ({ playwright }, use) => {
    const browser = await playwright.chromium.connectOverCDP(cdpEndpoint);
    await use(browser);
  }
});

export { expect };
