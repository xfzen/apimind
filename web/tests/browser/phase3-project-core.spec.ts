import { expect, test } from './support/test';

import { installConsoleGuard } from './support/consoleGuard';

test('template editor preserves save payload and destroys the real editor', async ({ page }) => {
  const guard = installConsoleGuard(page);
  await page.goto('/tests/fixtures/phase3-project-core.html');

  await page.getByPlaceholder('标题').fill('After');
  await page.getByPlaceholder('描述').fill('After description');
  await page.getByPlaceholder('变更原因').fill('phase3 reason');
  await page.getByPlaceholder('变更摘要').fill('phase3 summary');
  await page.locator('.toastui-editor-md-container .ProseMirror').fill('# After markdown');
  await page.getByRole('button', { name: /保\s*存/ }).click();

  await expect.poll(() => page.evaluate(() => window.__phase3TemplateSaved)).toEqual({
    key: 'phase3-template',
    title: 'After',
    description: 'After description',
    markdown: '# After markdown',
    change_reason: 'phase3 reason',
    change_summary: 'phase3 summary'
  });

  await page.getByTestId('unmount-template').click();
  await expect(page.locator('.template-editor')).toHaveCount(0);
  guard.assertNoErrors();
});
