import { expect, test } from './support/test';

import { installConsoleGuard } from './support/consoleGuard';

test('shared UI preserves loading and confirmation behavior', async ({ page }) => {
  const guard = installConsoleGuard(page);

  await page.goto('/tests/fixtures/phase3-shared-ui.html');
  const loading = page.locator('.loading-box');
  await expect(loading).toHaveCSS('display', 'none');

  await page.getByTestId('toggle-loading').click();
  await expect(loading).toHaveCSS('display', 'flex');
  await page.getByTestId('toggle-loading').click();
  await expect(loading).toHaveCSS('display', 'none');

  await page.getByRole('button', { name: '确 定' }).click();
  await expect
    .poll(() => page.evaluate(() => window.__phase3ConfirmResult))
    .toBe(true);

  await page.getByTestId('reopen-confirm').click();
  await page.getByRole('button', { name: '取 消' }).click();
  await expect
    .poll(() => page.evaluate(() => window.__phase3ConfirmResult))
    .toBe(false);
  guard.assertNoErrors();
});
