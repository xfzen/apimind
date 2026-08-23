import { installConsoleGuard } from './support/consoleGuard';
import { installMockApi } from './support/mockApi';
import { expect, test } from './support/test';

test('workspace docs entry reports an ensure error without navigating', async ({ page }) => {
  const guard = installConsoleGuard(page);
  await installMockApi(page, 'member');

  let requestedWorkspaceId = '';
  await page.route('**/api/docs/workspace_project**', async route => {
    requestedWorkspaceId = new URL(route.request().url()).searchParams.get('workspace_id') || '';
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ errcode: 403, errmsg: '没有权限', data: null })
    });
  });

  await page.goto('/group/11');
  const entry = page.getByRole('button', { name: '文档中心', exact: true });
  await entry.click();

  await expect(page.getByText('没有权限', { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/group\/11$/);
  await expect(entry).toBeEnabled();
  expect(requestedWorkspaceId).toBe('11');
  guard.assertNoErrors();
});
