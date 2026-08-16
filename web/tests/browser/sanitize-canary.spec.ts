import { expect, test } from './support/test';

import { installConsoleGuard } from './support/consoleGuard';

test('DOMPurify removes executable markup and keeps safe content', async ({ page }) => {
  const guard = installConsoleGuard(page);

  await page.goto('/tests/fixtures/sanitize-canary.html');

  const output = page.getByTestId('sanitize-output');
  await expect(output.getByText('safe content')).toBeVisible();
  await expect(output.locator('img')).toHaveAttribute('src', 'data:image/gif;base64,R0lGODlhAQABAAAAACw=');
  await expect(output.locator('img')).not.toHaveAttribute('onerror', /.+/);
  await expect(output.locator('script')).toHaveCount(0);
  guard.assertNoErrors();
});
