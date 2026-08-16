import { expect, test } from './support/test';

import { installConsoleGuard } from './support/consoleGuard';

test('React root is reused and can be unmounted cleanly', async ({ page }) => {
  const guard = installConsoleGuard(page);

  await page.goto('/tests/fixtures/phase3-react-root.html');
  await expect(page.getByTestId('root-value')).toHaveText('second');
  await expect
    .poll(() => page.evaluate(() => window.__phase3SameRoot))
    .toBe(true);

  await page.getByTestId('unmount-root').click();
  await expect(page.locator('#root-under-test')).toBeEmpty();
  guard.assertNoErrors();
});
