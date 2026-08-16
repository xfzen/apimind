import { expect, test } from './support/test';

import { installConsoleGuard } from './support/consoleGuard';

test('Redux store initializes every fixed TypeScript reducer', async ({ page }) => {
  const guard = installConsoleGuard(page);

  await page.goto('/tests/fixtures/store-canary.html');

  await expect(page.getByTestId('store-keys')).toHaveText(
    'addInterface,docs,follow,group,inter,interfaceCol,menu,mockCol,news,project,template,user'
  );
  guard.assertNoErrors();
});
