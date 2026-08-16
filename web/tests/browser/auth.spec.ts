import { expect, test } from './support/test';

import { installConsoleGuard } from './support/consoleGuard';
import { installMockApi } from './support/mockApi';

test('guest login renders the form and registration tab', async ({ page }) => {
  const guard = installConsoleGuard(page);
  await installMockApi(page, 'guest');

  await page.goto('/login');

  await expect(page.getByPlaceholder('Email')).toBeVisible();
  await expect(page.getByPlaceholder('Password')).toBeVisible();
  await expect(page.getByRole('tab', { name: '注册' })).toBeVisible();
  guard.assertNoErrors();
});

test('successful login posts credentials and renders the personal group', async ({ page }) => {
  const guard = installConsoleGuard(page);
  await installMockApi(page, 'login-success');
  let postedCredentials: unknown;
  page.on('request', request => {
    if (new URL(request.url()).pathname === '/api/user/login') {
      postedCredentials = request.postDataJSON();
    }
  });

  await page.goto('/login');
  await page.getByPlaceholder('Email').fill('pilot@example.invalid');
  await page.getByPlaceholder('Password').fill('pilot-password');
  await page.getByRole('button', { name: /登\s*录/ }).click();

  await expect(page).toHaveURL(/\/group(?:\/11)?$/);
  await expect(page.getByText('个人空间', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('tab', { name: '项目列表' })).toBeVisible();
  expect(postedCredentials).toEqual({
    email: 'pilot@example.invalid',
    password: 'pilot-password'
  });
  guard.assertNoErrors();
});

test('failed login stays unauthenticated without an unhandled rejection', async ({ page }) => {
  const guard = installConsoleGuard(page);
  await installMockApi(page, 'login-failure');

  await page.goto('/login');
  await page.getByPlaceholder('Email').fill('pilot@example.invalid');
  await page.getByPlaceholder('Password').fill('wrong-password');
  await page.getByRole('button', { name: /登\s*录/ }).click();

  await expect(page.getByText('用户名或密码错误', { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('tab', { name: '项目列表' })).toHaveCount(0);
  guard.assertNoErrors();
});
