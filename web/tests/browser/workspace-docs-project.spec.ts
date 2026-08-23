import { installConsoleGuard } from './support/consoleGuard';
import { installMockApi } from './support/mockApi';
import { expect, test } from './support/test';

test('workspace docs project is listed without a separate docs center action', async ({ page }) => {
  const guard = installConsoleGuard(page);
  await installMockApi(page, 'member');

  await page.goto('/group/11');
  await expect(page.getByRole('button', { name: '文档中心', exact: true })).toHaveCount(0);
  const docsCard = page.locator('.card-container').filter({ hasText: '工作区文档' });
  await expect(docsCard).toHaveCount(1);
  await expect(docsCard.locator('.card-btns')).toHaveCount(0);
  await expect(docsCard.locator('.copy-btns')).toHaveCount(0);
  guard.assertNoErrors();
});
