import { installConsoleGuard } from './support/consoleGuard';
import { expect, test } from './support/test';

const username = process.env.APIMIND_DEFAULT_USERNAME ?? 'admin@example.invalid';
const password = process.env.APIMIND_DEFAULT_PASSWORD;

if (!password) {
  throw new Error('APIMIND_DEFAULT_PASSWORD is required for live authentication');
}

test('live Go stack authenticates and renders the personal group', async ({ page }) => {
  const guard = installConsoleGuard(page);

  await page.goto('/login');
  await page.getByPlaceholder('Email').fill(username);
  await page.getByPlaceholder('Password').fill(password);

  const loginResponsePromise = page.waitForResponse(response => {
    const url = new URL(response.url());
    return url.pathname === '/api/user/login' && response.request().method() === 'POST';
  });
  await page.getByRole('button', { name: /登\s*录/ }).click();

  const loginResponse = await loginResponsePromise;
  const loginBody: unknown = await loginResponse.json();
  expect(loginBody).toMatchObject({ errcode: 0 });
  await expect(page).toHaveURL(/\/group(?:\/\d+)?$/);
  await expect(page.getByText('个人空间', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('tab', { name: '项目列表' })).toBeVisible();

  await page.goto('/user/list');
  const userLink = page.getByRole('link', { name: username, exact: true });
  await expect(userLink).toHaveAttribute('href', '/user/profile/11');
  await expect(page.getByRole('cell', { name: /\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/ })).toBeVisible();
  guard.assertNoErrors();
});
