import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/auth/session')) {
      await route.fulfill({ json: { id: 'session-1', principal_id: 'principal-1', enterprise_id: 'enterprise-1', expires_at: 1999999999, csrf_token: 'csrf-1' } })
      return
    }
    if (path.endsWith('/meta/health')) {
      await route.fulfill({ json: { status: 'ok', version: '0.1.0', database: 'ok', casdoor: 'ok' } })
      return
    }
    if (path.endsWith('/operations/backup/status')) {
      await route.fulfill({ json: { state: 'verified', backup_id: 'backup-1', manifest_hash: 'hash-1', verified_at: 1787530000 } })
      return
    }
    await route.fulfill({ status: 404, json: { reason: 'fixture_not_found' } })
  })
})

test('authenticated operator sees health and verified restore state', async ({ page }) => {
  await page.goto('/operations')
  await expect(page.getByRole('heading', { name: '企业控制台' })).toBeVisible()
  await expect(page.getByText('principal-1')).toBeVisible()
  await expect(page.getByRole('heading', { name: '运行状态' })).toBeVisible()
  await expect(page.getByText('最近一次备份已通过空环境恢复验证')).toBeVisible()
  await expect(page.getByText('backup-1')).toBeVisible()
})
