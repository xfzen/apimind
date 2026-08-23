# Workspace Docs Entry Restoration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Repository instructions prohibit subagents, so execute every task in the primary session.

**Goal:** Restore the explicit Web entry that idempotently initializes and opens each workspace's default `工作区文档` project, while preserving and proving the existing Markdown outline behavior.

**Architecture:** Keep `DocService.EnsureWorkspaceProject` and `GET /api/docs/workspace_project` as the existing source of truth; the repair is a Web orchestration path, not a second provisioning implementation. A small typed helper owns the ensure-refresh-navigate sequence, `ProjectList` owns loading and user feedback, and `ProjectCard` treats `kind=docs` as a system project. An isolated Chrome-CDP live test starts from a fresh database and proves first entry, idempotency, project visibility, Markdown outline rendering, and heading navigation.

**Tech Stack:** React 18 class components, Redux + `redux-promise`, TypeScript 5.9, Ant Design, AVA, Playwright over Chrome CDP, Go service, Docker Compose.

**Spec:** `server/docs/history/doc-center-project-groups-write-policy-spec.md`

## Global Constraints

- Follow the repository hierarchy `workspace / project / cat / interface`; the docs center remains `workspace / 工作区文档 project(kind=docs) / doc group / doc`.
- Each workspace has exactly one default docs project; provisioning and default-group creation must remain idempotent.
- Use the existing Go endpoint through the Web dev proxy. Web code must not call remote ApiMind, YApi, or business APIs directly.
- Do not change the API contract flow, generic doc write policy, MCP policy, database schema, or generated Go API files.
- Do not directly access or modify the database. Fresh-state verification must use the existing isolated Docker Compose smoke environment.
- Do not update or sync ApiMind API documentation; this repair does not change the HTTP contract.
- Do not delete ApiMind resources and do not restore the deleted dormant JS components (`DocToc.js`, `DocTree.js`, `MarkdownOutline.js`, or `MilkdownEditor.js`).
- Do not add dependencies. Use the installed React, Redux, AVA, Playwright, and Chrome-CDP infrastructure.
- Do not package or build the desktop application. Keep Web dev port `4000`/test alternatives and Go service port `18889`/test alternatives separate from embedded desktop port `18888`.
- Preserve the pre-existing uncommitted changes in `web/client/containers/User/List.tsx` and `web/tests/browser/live-auth.spec.ts`. Every commit command below stages only the named repair files.

## Confirmed Current-State Facts

- `server/internal/service/doc/service.go` already creates or returns the `kind=docs` project and ensures `Public`, `Templates`, and normal-project groups.
- `web/client/reducer/modules/docs.ts` already exposes `ensureWorkspaceDocsProject`, but no Web component calls it.
- `web/client/containers/Project/Interface/Docs/DocsInterface.tsx` still routes docs projects to the docs workspace and renders `OUTLINE` from `extractHeadings`.
- `web/client/components/Docs/markdownHeadings.ts` and `web/test/common/docs-markdown-headings.test.js` already cover Markdown heading extraction.
- The recently deleted JS outline/editor components had no callers. Restoring them would reintroduce parallel implementations without restoring the missing entry.

## Acceptance Criteria

1. A writable, non-system workspace shows a `文档中心` button even when no docs project exists.
2. Clicking the button calls `/api/docs/workspace_project` exactly once while the button is loading.
3. A successful response refreshes the current project list and navigates to `/project/<docs-project-id>/interface/api`.
4. An API error displays its `errmsg`, clears loading, and neither refreshes nor navigates.
5. Re-entering the docs center returns the same project ID; the project list contains exactly one `kind=docs` project.
6. `kind=docs` and `kind=template` cards expose neither follow nor copy controls.
7. A Markdown document with `#`, `##`, and `###` headings renders an `OUTLINE`; clicking a heading activates it and brings the rendered heading into view.
8. Existing Go service tests, Web unit tests, deterministic browser tests, TypeScript checks, production Web build, and isolated live smoke all pass.

---

### Task 1: Type and Test the Ensure-Refresh-Navigate Orchestration

**Files:**
- Modify: `web/client/reducer/modules/docs.ts`
- Create: `web/client/containers/Group/ProjectList/workspaceDocsEntry.ts`
- Create: `web/test/common/workspace-docs-entry.test.js`
- Test: `web/tests/redux-phase-2-content.test.mjs`

**Interfaces:**
- Consumes: `ensureWorkspaceDocsProject(workspaceId)` and the existing Redux promise result shape `ResolvedPromiseAction<ApiResponse<T>>`.
- Produces: `WorkspaceDocsProject` with `_id`, `name`, `group_id`, `desc`, and `kind`; `openWorkspaceDocsProject(input): Promise<ApiResponse<WorkspaceDocsProject>>`.
- Guarantees: refresh and navigation occur only when `hasApiData(response)` is true.

- [x] **Step 1: Add failing success and failure tests for the orchestration helper**

Create `web/test/common/workspace-docs-entry.test.js`:

```js
import test from 'ava';
import { openWorkspaceDocsProject } from '../../client/containers/Group/ProjectList/workspaceDocsEntry.ts';

const docsProject = {
  _id: 33,
  name: '工作区文档',
  group_id: 11,
  desc: '当前工作区的文档项目',
  kind: 'docs'
};

test('openWorkspaceDocsProject refreshes and navigates after ensure succeeds', async t => {
  const calls = [];
  const response = await openWorkspaceDocsProject({
    workspaceId: 11,
    page: 2,
    ensure: async workspaceId => {
      calls.push(['ensure', workspaceId]);
      return {
        type: 'yapi/docs/WORKSPACE_DOCS_PROJECT',
        payload: { data: { errcode: 0, errmsg: '成功！', data: docsProject } }
      };
    },
    refresh: async (workspaceId, page) => calls.push(['refresh', workspaceId, page]),
    navigate: path => calls.push(['navigate', path])
  });

  t.deepEqual(response.data, docsProject);
  t.deepEqual(calls, [
    ['ensure', 11],
    ['refresh', 11, 2],
    ['navigate', '/project/33/interface/api']
  ]);
});

test('openWorkspaceDocsProject returns API errors without refresh or navigation', async t => {
  const calls = [];
  const response = await openWorkspaceDocsProject({
    workspaceId: 11,
    page: 1,
    ensure: async workspaceId => {
      calls.push(['ensure', workspaceId]);
      return {
        type: 'yapi/docs/WORKSPACE_DOCS_PROJECT',
        payload: { data: { errcode: 403, errmsg: '没有权限', data: null } }
      };
    },
    refresh: async (...args) => calls.push(['refresh', ...args]),
    navigate: path => calls.push(['navigate', path])
  });

  t.is(response.errcode, 403);
  t.deepEqual(calls, [['ensure', 11]]);
});
```

- [x] **Step 2: Run the focused test and verify the missing module is the failure**

Run:

```bash
cd web
./node_modules/.bin/ava test/common/workspace-docs-entry.test.js
```

Expected: FAIL because `workspaceDocsEntry.ts` does not exist.

- [x] **Step 3: Add the exact docs-project response type**

In `web/client/reducer/modules/docs.ts`, add the exported data contract and narrow the ensure action:

```ts
export interface WorkspaceDocsProject {
  _id: number;
  name: string;
  group_id: number;
  desc: string;
  kind: 'docs';
}

export function ensureWorkspaceDocsProject(workspaceId: string | number) {
  return getAction<WorkspaceDocsProject>(
    actionTypes.WORKSPACE_DOCS_PROJECT,
    '/api/docs/workspace_project',
    { workspace_id: workspaceId }
  );
}
```

Do not add `WORKSPACE_DOCS_PROJECT` to `docsReducer`: opening the docs center is a command result, not durable docs-list state.

- [x] **Step 4: Implement the orchestration helper**

Create `web/client/containers/Group/ProjectList/workspaceDocsEntry.ts`:

```ts
import type { ApiResponse } from '../../../types/api';
import { hasApiData } from '../../../types/api';
import type { ResolvedPromiseAction } from '../../../reducer/promiseTypes';
import type { WorkspaceDocsProject } from '../../../reducer/modules/docs';

type EnsureWorkspaceDocsProject = (
  workspaceId: string | number
) => Promise<ResolvedPromiseAction<ApiResponse<WorkspaceDocsProject>>>;

interface OpenWorkspaceDocsProjectInput {
  workspaceId: string | number;
  page: number;
  ensure: EnsureWorkspaceDocsProject;
  refresh: (workspaceId: string | number, page: number) => unknown;
  navigate: (path: string) => void;
}

export async function openWorkspaceDocsProject(
  input: OpenWorkspaceDocsProjectInput
): Promise<ApiResponse<WorkspaceDocsProject>> {
  const action = await input.ensure(input.workspaceId);
  const response = action.payload.data;
  if (!hasApiData(response)) return response;

  await Promise.resolve(input.refresh(input.workspaceId, input.page));
  input.navigate(`/project/${response.data._id}/interface/api`);
  return response;
}
```

- [x] **Step 5: Run focused and Redux contract tests**

Run:

```bash
cd web
./node_modules/.bin/ava test/common/workspace-docs-entry.test.js
cd ..
node --test web/tests/redux-phase-2-content.test.mjs
```

Expected: both commands PASS; the Redux contract still records `GET /api/docs/workspace_project?workspace_id=<id>`.

- [x] **Step 6: Run TypeScript checking for the new public types**

Run:

```bash
cd web
npm run typecheck
```

Expected: PASS with no `WorkspaceDocsProject` or promise-result type errors.

- [x] **Step 7: Commit only the orchestration unit**

```bash
git add web/client/reducer/modules/docs.ts web/client/containers/Group/ProjectList/workspaceDocsEntry.ts web/test/common/workspace-docs-entry.test.js
git diff --cached --check
git commit -m "fix(web): add workspace docs entry orchestration"
```

---

### Task 2: Wire the Explicit Workspace Docs Entry and Prove It Live

**Files:**
- Modify: `web/client/containers/Group/ProjectList/ProjectList.tsx`
- Modify: `web/client/containers/Project/Project.tsx`
- Modify: `web/client/containers/Project/Interface/Interface.tsx`
- Modify: `web/client/components/Subnav/Subnav.tsx`
- Modify: `web/client/components/ProjectCard/ProjectCard.tsx`
- Modify: `web/playwright.config.ts`
- Modify: `web/playwright.live.config.ts`
- Modify: `web/scripts/smoke/typescript-pilot-live.sh`
- Create: `web/tests/browser/workspace-docs-entry.spec.ts`
- Create: `web/tests/browser/live-workspace-docs.spec.ts`

**Interfaces:**
- Consumes: `openWorkspaceDocsProject`, `ensureWorkspaceDocsProject`, `ProjectListGroup._id`, `currPage`, and React Router `history.push`.
- Produces: `ProjectList.openWorkspaceDocs()` and a visible `文档中心` button for `admin`, `owner`, or `dev` users in non-system workspaces.
- Deterministic contract: a mocked API denial displays the backend `errmsg`, leaves the user on the group page, and restores the button to an enabled state.
- Live contract: the test uses only browser-visible actions plus authenticated HTTP requests through the same Go-backed Web origin; it never reads or writes MongoDB directly.
- Console contract: the newly covered project/docs route must not emit the pre-existing React unsafe-lifecycle or Ant Design deprecated-component warnings; use `UNSAFE_` lifecycle names and current Ant Design `items`/`variant` APIs without changing behavior.

- [x] **Step 1: Add the deterministic API-error regression test**

Create `web/tests/browser/workspace-docs-entry.spec.ts`:

```ts
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
```

- [x] **Step 2: Add the fresh-database live regression test**

Create `web/tests/browser/live-workspace-docs.spec.ts`:

```ts
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

test('workspace docs entry provisions once and preserves Markdown outline navigation', async ({ page }) => {
  const guard = installConsoleGuard(page);
  await login(page);

  const groupResponse = await page.request.get('/api/group/get_mygroup');
  const group = await groupResponse.json() as LiveApiResponse<LiveGroup>;
  const workspaceId = group.data._id;
  await page.goto(`/group/${workspaceId}`);

  const beforeResponse = await page.request.get('/api/project/list', {
    params: { group_id: workspaceId, page: 1, limit: 100 }
  });
  const before = await beforeResponse.json() as LiveApiResponse<{ list: LiveProject[] }>;
  expect(before.data.list.filter(project => project.kind === 'docs')).toHaveLength(0);

  const ensureResponsePromise = page.waitForResponse(response => {
    const url = new URL(response.url());
    return url.pathname === '/api/docs/workspace_project' && response.request().method() === 'GET';
  });
  let ensureRequestCount = 0;
  page.on('request', request => {
    if (new URL(request.url()).pathname === '/api/docs/workspace_project') {
      ensureRequestCount += 1;
    }
  });
  const docsEntry = page.getByRole('button', { name: '文档中心', exact: true });
  await docsEntry.evaluate(button => {
    const entryButton = button as HTMLButtonElement;
    entryButton.click();
    entryButton.click();
  });

  const ensureResponse = await ensureResponsePromise;
  const firstEnsure = await ensureResponse.json() as LiveApiResponse<LiveProject>;
  expect(firstEnsure).toMatchObject({
    errcode: 0,
    data: { name: '工作区文档', group_id: workspaceId, kind: 'docs' }
  });
  expect(ensureRequestCount).toBe(1);
  const docsProjectId = firstEnsure.data._id;
  await expect(page).toHaveURL(new RegExp(`/project/${docsProjectId}/interface/api$`));

  const secondEnsureResponse = await page.request.get('/api/docs/workspace_project', {
    params: { workspace_id: workspaceId }
  });
  const secondEnsure = await secondEnsureResponse.json() as LiveApiResponse<LiveProject>;
  expect(secondEnsure.data._id).toBe(docsProjectId);

  const projectsResponse = await page.request.get('/api/project/list', {
    params: { group_id: workspaceId, page: 1, limit: 100 }
  });
  const projects = await projectsResponse.json() as LiveApiResponse<{ list: LiveProject[] }>;
  expect(projects.data.list.filter(project => project.kind === 'docs')).toHaveLength(1);

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
  guard.assertNoErrors();
});
```

Keep all data setup inside the isolated live stack. Do not add cleanup calls that delete ApiMind resources; `docker compose down -v` already discards the test volume.

- [x] **Step 3: Route live specs only through the live configuration**

Change `web/playwright.config.ts` to:

```ts
testIgnore: ['live-*.spec.ts'],
```

Change `web/playwright.live.config.ts` to:

```ts
testMatch: ['live-*.spec.ts'],
```

Change the final command in `web/scripts/smoke/typescript-pilot-live.sh` to:

```sh
npx playwright test --config playwright.live.config.ts
```

This preserves the deterministic browser suite while making the isolated live target run both authentication and workspace-docs scenarios.

- [x] **Step 4: Run both regressions and verify the missing entry is the failure**

Run the deterministic test:

```bash
cd web
./node_modules/.bin/playwright test tests/browser/workspace-docs-entry.spec.ts
cd ..
```

Expected: FAIL because no `文档中心` button exists.

Run from the repository root:

```bash
APIMIND_DEFAULT_PASSWORD='apimind-live-smoke-only' make test-web-browser-live
```

Expected: `live-auth.spec.ts` passes, while `live-workspace-docs.spec.ts` fails because no `文档中心` button exists. The isolated Compose stack and volume are removed by the script trap.

- [x] **Step 5: Add typed routing and loading state to `ProjectList`**

Update imports in `web/client/containers/Group/ProjectList/ProjectList.tsx`:

```ts
import { Row, Col, Button, Tooltip, Space, message } from 'antd';
import { Link, withRouter } from 'react-router-dom';
import type { RouteComponentProps } from 'react-router-dom';
import { ensureWorkspaceDocsProject } from '../../../reducer/modules/docs';
import type { WorkspaceDocsProject } from '../../../reducer/modules/docs';
import type { ApiResponse } from '../../../types/api';
import type { ResolvedPromiseAction } from '../../../reducer/promiseTypes';
import { openWorkspaceDocsProject } from './workspaceDocsEntry';
```

Extend the props and state contracts. Add `RouteComponentProps` to the existing `ProjectListProps` extension and add this action property without removing its current fields:

```ts
interface ProjectListProps extends RouteComponentProps {
  ensureWorkspaceDocsProject: (
    workspaceId: string | number
  ) => Promise<ResolvedPromiseAction<ApiResponse<WorkspaceDocsProject>>>;
}

interface ProjectListState {
  visible: boolean;
  protocol: string;
  projectData: ProjectListItem[];
  openingWorkspaceDocs: boolean;
}
```

Initialize `openingWorkspaceDocs: false` in the existing constructor state object:

```ts
this.state = {
  visible: false,
  protocol: 'http://',
  projectData: [],
  openingWorkspaceDocs: false
};
```

Add `ensureWorkspaceDocsProject` to the existing action object passed to `connect`:

```ts
{
  fetchProjectList,
  addProject,
  delProject,
  ensureWorkspaceDocsProject,
  setBreadcrumb
}
```

Add the matching runtime declaration to `ProjectList.propTypes`:

```ts
ensureWorkspaceDocsProject: PropTypes.func,
```

Add router injection using the established class-decorator pattern. Add a synchronous instance lock beside the class fields so two DOM clicks in the same event turn cannot dispatch two ensure requests:

```ts
const routeProjectList = asLegacyClassDecorator(withRouter);

@connectProjectList
@routeProjectList
class ProjectList extends Component<ProjectListProps, ProjectListState> {
  openingWorkspaceDocsRequest = false;
```

- [x] **Step 6: Implement the guarded click handler**

Add this method to `ProjectList`:

```ts
@autobind
async openWorkspaceDocs() {
  const workspaceId = this.props.currGroup._id;
  if (workspaceId === undefined || this.openingWorkspaceDocsRequest) return;

  this.openingWorkspaceDocsRequest = true;
  this.setState({ openingWorkspaceDocs: true });
  try {
    const response = await openWorkspaceDocsProject({
      workspaceId,
      page: this.props.currPage,
      ensure: this.props.ensureWorkspaceDocsProject,
      refresh: this.props.fetchProjectList,
      navigate: path => this.props.history.push(path)
    });
    if (response.errcode !== 0 || !response.data) {
      message.error(response.errmsg || '文档中心打开失败');
    }
  } catch {
    message.error('文档中心打开失败');
  } finally {
    this.openingWorkspaceDocsRequest = false;
    this.setState({ openingWorkspaceDocs: false });
  }
}
```

The state guard prevents double clicks from dispatching concurrent ensure calls. Backend idempotency remains the protection across separate visits or callers.

- [x] **Step 7: Render the explicit entry beside ordinary project creation**

Inside the existing `canManageProjects` true branch, replace the single add-project link with:

```tsx
<Space>
  <Button
    loading={this.state.openingWorkspaceDocs}
    onClick={this.openWorkspaceDocs}
  >
    文档中心
  </Button>
  <Link to="/add-project">
    <Button type="primary">添加项目</Button>
  </Link>
</Space>
```

Do not auto-call the mutating ensure endpoint from `componentDidMount`, `render`, or project-list fetching. The trigger remains the explicit workspace doc-center entry required by the spec.

- [x] **Step 8: Run unit, deterministic browser, type, build, and live verification**

Before running the gate, remove warnings surfaced by the new live route without changing project navigation behavior:

- Rename `Project.componentWillMount`, `Project.componentWillReceiveProps`, and `Interface.componentWillMount` to their exact `UNSAFE_` equivalents without changing their bodies.
- Replace `ProjectCard`'s `bordered={false}` with `variant="borderless"`.
- Build `MenuProps['items']` from `Subnav` props and pass it through `<Menu items={items} />` without mutating `item.name`.
- Preserve the existing two-character spacing, link target, selected key, mode, and class names. Do not add console warnings to the allowlist.

Run:

```bash
cd web
./node_modules/.bin/ava test/common/workspace-docs-entry.test.js test/common/docs-markdown-headings.test.js
npm run test:browser
npm run typecheck
npm run build
cd ..
APIMIND_DEFAULT_PASSWORD='apimind-live-smoke-only' make test-web-browser-live
```

Expected:

- both focused AVA files pass;
- deterministic browser coverage passes, including the API-error path;
- TypeScript and production Vite build pass;
- both live specs pass;
- live output proves the first ensure creates the docs project, the second returns the same `_id`, and the outline interaction succeeds.

- [x] **Step 9: Commit only the entry and regression files**

```bash
git add web/client/containers/Group/ProjectList/ProjectList.tsx web/client/containers/Project/Project.tsx web/client/containers/Project/Interface/Interface.tsx web/client/components/Subnav/Subnav.tsx web/client/components/ProjectCard/ProjectCard.tsx web/playwright.config.ts web/playwright.live.config.ts web/scripts/smoke/typescript-pilot-live.sh web/tests/browser/workspace-docs-entry.spec.ts web/tests/browser/live-workspace-docs.spec.ts
git diff --cached --check
git commit -m "fix(web): restore workspace docs center entry"
```

---

### Task 3: Protect System Project Cards From Ordinary Project Actions

**Files:**
- Create: `web/client/components/ProjectCard/projectKind.ts`
- Modify: `web/client/components/ProjectCard/ProjectCard.tsx`
- Create: `web/test/common/project-kind.test.js`
- Modify: `web/tests/browser/live-workspace-docs.spec.ts`

**Interfaces:**
- Consumes: `ProjectData.kind`.
- Produces: `isSystemProjectKind(kind?: string): boolean` returning true for `docs` and `template` only.
- UI guarantee: a system project card remains navigable, but follow and copy actions are not rendered.

- [x] **Step 1: Add a failing classification test**

Create `web/test/common/project-kind.test.js`:

```js
import test from 'ava';
import { isSystemProjectKind } from '../../client/components/ProjectCard/projectKind.ts';

test('isSystemProjectKind protects docs and template projects only', t => {
  t.true(isSystemProjectKind('docs'));
  t.true(isSystemProjectKind('template'));
  t.false(isSystemProjectKind('api'));
  t.false(isSystemProjectKind(''));
  t.false(isSystemProjectKind(undefined));
});
```

- [x] **Step 2: Run the test and verify the missing helper is the failure**

Run:

```bash
cd web
./node_modules/.bin/ava test/common/project-kind.test.js
```

Expected: FAIL because `projectKind.ts` does not exist.

- [x] **Step 3: Implement the system-kind predicate**

Create `web/client/components/ProjectCard/projectKind.ts`:

```ts
const SYSTEM_PROJECT_KINDS = new Set(['docs', 'template']);

export function isSystemProjectKind(kind?: string): boolean {
  return SYSTEM_PROJECT_KINDS.has(kind || '');
}
```

- [x] **Step 4: Apply the predicate to both card action branches**

In `web/client/components/ProjectCard/ProjectCard.tsx`, import the helper:

```ts
import { isSystemProjectKind } from './projectKind';
```

Replace `isTemplateProject` with:

```ts
const isSystemProject = isSystemProjectKind(projectData.kind);
```

Then make these two exact guard substitutions:

```diff
-        {!isTemplateProject && (
+        {!isSystemProject && (

-        {isShow && !isTemplateProject && (
+        {isShow && !isSystemProject && (
```

Do not disable the card's main `history.push`; docs projects must remain openable from the refreshed project list.

- [x] **Step 5: Extend the live test to verify the visible project-card result**

Append these assertions before `guard.assertNoErrors()` in `web/tests/browser/live-workspace-docs.spec.ts`:

```ts
await page.goto(`/group/${workspaceId}`);
const docsCard = page.locator('.card-container').filter({ hasText: '工作区文档' });
await expect(docsCard).toHaveCount(1);
await expect(docsCard.locator('.card-btns')).toHaveCount(0);
await expect(docsCard.locator('.copy-btns')).toHaveCount(0);
```

- [x] **Step 6: Run focused, deterministic, and live verification**

Run:

```bash
cd web
./node_modules/.bin/ava test/common/project-kind.test.js
npm run typecheck
npm run test:browser
cd ..
APIMIND_DEFAULT_PASSWORD='apimind-live-smoke-only' make test-web-browser-live
```

Expected: all commands PASS; the docs card remains visible once and has no follow/copy controls.

- [x] **Step 7: Commit only system-card behavior and its tests**

```bash
git add web/client/components/ProjectCard/projectKind.ts web/client/components/ProjectCard/ProjectCard.tsx web/test/common/project-kind.test.js web/tests/browser/live-workspace-docs.spec.ts
git diff --cached --check
git commit -m "fix(web): protect workspace docs project actions"
```

---

### Task 4: Run the Full Repair Gate and Record a Clean Handoff

**Files:**
- Verify only: `server/internal/service/doc/service.go`
- Verify only: `server/internal/service/doc/service_test.go`
- Verify only: `web/client/components/Docs/markdownHeadings.ts`
- Verify only: `web/client/containers/Project/Interface/Docs/DocsInterface.tsx`
- Verify: all files changed by Tasks 1-3

**Interfaces:**
- Consumes: all prior task outputs.
- Produces: verification evidence and a clean staged state; no new runtime interface.

- [x] **Step 1: Re-run the existing backend idempotency coverage**

Run:

```bash
cd server
go test ./internal/service/doc
```

Expected: PASS, including creation, default groups, idempotency, system-kind exclusion, and reserved-name conflict tests.

- [x] **Step 2: Run the complete non-live Web gate**

Run from the repository root:

```bash
make test-web
make test-web-browser
```

Expected: all repository-boundary, lint, typecheck, AVA, and deterministic Chrome-CDP tests PASS.

- [x] **Step 3: Run the production Web build without desktop packaging**

Run:

```bash
cd web
npm run build
```

Expected: Vite production build PASS. Do not run desktop bundle or packaging commands.

- [x] **Step 4: Run the final isolated live smoke on non-embedded ports**

Run from the repository root:

```bash
APIMIND_DEFAULT_PASSWORD='apimind-live-smoke-only' \
APIMIND_LIVE_SERVER_PORT=18890 \
APIMIND_LIVE_WEB_PORT=4002 \
APIMIND_LIVE_CDP_PORT=19223 \
make test-web-browser-live
```

Expected: `live-auth.spec.ts` and `live-workspace-docs.spec.ts` both PASS, and cleanup removes the isolated Compose project and volumes.

- [x] **Step 5: Inspect scope, whitespace, and unrelated working-tree changes**

Run:

```bash
git status --short
git diff --check
git log --oneline -3
```

Expected:

- the three repair commits are at the branch tip;
- there are no whitespace errors;
- the pre-existing `web/client/containers/User/List.tsx` and `web/tests/browser/live-auth.spec.ts` changes remain preserved unless separately committed by the user;
- no generated Go API file, ApiMind mapping, database artifact, deleted JS component, dependency manifest, or desktop bundle was changed.

- [x] **Step 6: If verification exposes a regression, stop the handoff and repair it in the owning task**

Use the failing command and first relevant error as evidence. Amend the task's implementation and tests, rerun that task's focused gate, then rerun Steps 1-5. Do not weaken selectors, suppress console errors, skip tests, or broaden the scope to unrelated refactors.

## Execution Notes

- Execute tasks in order because Task 2 consumes Task 1's helper and Task 3 extends Task 2's live scenario.
- The plan deliberately leaves the existing mutating GET contract unchanged. Replacing it with POST would require an API migration and ApiMind documentation work outside this repair.
- The plan deliberately keeps outline implementation unchanged. Its failure mode is reachability: without a docs project entry, users cannot reach the already-active TypeScript outline.
- The exact older commit that first removed the Web entry is **需要验证** because available history is squashed before the unified baseline; this does not block the code-level repair.

## Execution Result — 2026-08-23

- Task 1 committed as `0217ede fix(web): add workspace docs entry orchestration`.
- Task 2 committed as `424b101 fix(web): restore workspace docs center entry`.
- Task 3 committed as `0b12741 fix(web): protect workspace docs project actions`.
- `go test ./internal/service/doc`: PASS.
- `make test-web`: PASS with 87 Node tests and 37 AVA tests.
- `npm run test:browser`: PASS with 10 Chrome-CDP tests.
- Isolated live smoke: PASS with 2 Chrome-CDP tests, including initialization, idempotency, outline navigation, and system-card controls.
- `npm run build`: PASS with 6,842 transformed modules.
- Final live smoke used free ports `18901` (Go), `4010` (Web), and `19231` (Chrome CDP) because the originally planned `18890` port was occupied.
- Pre-existing changes in `web/client/containers/User/List.tsx` and `web/tests/browser/live-auth.spec.ts` remained outside the three implementation commits.
