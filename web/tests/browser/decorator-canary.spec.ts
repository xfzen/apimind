import { expect, test } from './support/test';

import { installConsoleGuard } from './support/consoleGuard';

test('legacy decorator callback remains bound', async ({ page }) => {
  const guard = installConsoleGuard(page);

  await page.goto('/tests/fixtures/legacy-decorator-canary.html');
  await expect(page.getByTestId('decorator-value')).toHaveText('connected:0');
  await page.getByTestId('decorator-increment').click();
  await expect(page.getByTestId('decorator-value')).toHaveText('connected:1');
  guard.assertNoErrors();
});
