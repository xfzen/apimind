import type { Page } from '@playwright/test';

import { installConsoleGuard } from './support/consoleGuard';
import { expect, test } from './support/test';

interface LiveApiResponse<T> {
  errcode: number;
  errmsg: string;
  data: T;
}

interface LiveProject {
  _id: number;
  name: string;
  group_id: number;
  kind?: string;
}

interface LiveGroup {
  _id: number;
  group_name: string;
  type: string;
}

interface LiveDoc {
  id: number;
  title: string;
  doc_type: string;
}

const username = process.env.APIMIND_DEFAULT_USERNAME ?? 'admin@example.invalid';
const password = process.env.APIMIND_DEFAULT_PASSWORD;

if (!password) {
  throw new Error('APIMIND_DEFAULT_PASSWORD is required for live workspace docs verification');
}
const livePassword: string = password;

async function login(page: Page) {
  await page.goto('/login');
  await page.getByPlaceholder('Email').fill(username);
  await page.getByPlaceholder('Password').fill(livePassword);
  await page.getByRole('button', { name: /登\s*录/ }).click();
  await expect(page).toHaveURL(/\/group(?:\/\d+)?$/);
}

test('new workspace includes one docs project and preserves Markdown outline navigation', async ({ page }) => {
  const guard = installConsoleGuard(page);
  await login(page);

  const groupResponse = await page.request.post('/api/group/add', {
    data: {
      group_name: `Docs smoke ${Date.now()}`,
      group_desc: 'isolated workspace docs smoke'
    }
  });
  const group = await groupResponse.json() as LiveApiResponse<LiveGroup>;
  expect(group.errcode).toBe(0);
  const workspaceId = group.data._id;
  await page.goto(`/group/${workspaceId}`);

  const projectsResponse = await page.request.get('/api/project/list', {
    params: { group_id: workspaceId, page: 1, limit: 100 }
  });
  const projects = await projectsResponse.json() as LiveApiResponse<{ list: LiveProject[] }>;
  const docsProjects = projects.data.list.filter(project => project.kind === 'docs');
  expect(docsProjects).toHaveLength(1);
  expect(docsProjects[0]).toMatchObject({
    name: '工作区文档',
    group_id: workspaceId,
    kind: 'docs'
  });
  const docsProjectId = docsProjects[0]._id;

  await expect(page.getByRole('button', { name: '文档中心', exact: true })).toHaveCount(0);
  const docsCard = page.locator('.card-container').filter({ hasText: '工作区文档' });
  await expect(docsCard).toHaveCount(1);
  await expect(docsCard.locator('.card-btns')).toHaveCount(0);
  await expect(docsCard.locator('.copy-btns')).toHaveCount(0);

  const secondEnsureResponse = await page.request.get('/api/docs/workspace_project', {
    params: { workspace_id: workspaceId }
  });
  const secondEnsure = await secondEnsureResponse.json() as LiveApiResponse<LiveProject>;
  expect(secondEnsure.data._id).toBe(docsProjectId);

  const docsResponse = await page.request.get('/api/docs/list', {
    params: { workspace_id: workspaceId, project_id: docsProjectId }
  });
  const docs = await docsResponse.json() as LiveApiResponse<LiveDoc[]>;
  const publicGroup = docs.data.find(doc => doc.doc_type === 'group' && doc.title === 'Public');
  if (!publicGroup) {
    throw new Error('Public doc group was not initialized');
  }

  const createResponse = await page.request.post('/api/docs/create', {
    data: {
      workspace_id: workspaceId,
      project_id: docsProjectId,
      parent_id: publicGroup.id,
      title: 'Outline smoke',
      content_md: '# 总览\n\n## 快速开始\n\n### 细节\n'
    }
  });
  const created = await createResponse.json() as LiveApiResponse<LiveDoc>;
  expect(created.errcode).toBe(0);

  await page.goto(`/project/${docsProjectId}/interface/api/${created.data.id}`);
  await expect(page.getByText('Outline smoke', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: '切换到目录' }).click();
  await expect(page.getByText('OUTLINE', { exact: true })).toBeVisible();
  await expect(page.locator('.doc-side-toc-item')).toHaveText(['总览', '快速开始', '细节']);

  const quickStart = page.locator('.doc-side-toc-item', { hasText: '快速开始' });
  await quickStart.click();
  await expect(quickStart).toHaveClass(/active/);
  await expect(page.locator('#快速开始')).toBeInViewport();

  await page.goto(`/group/${workspaceId}`);
  await expect(docsCard).toHaveCount(1);
  await expect(docsCard.locator('.card-btns')).toHaveCount(0);
  await expect(docsCard.locator('.copy-btns')).toHaveCount(0);
  guard.assertNoErrors();
});
