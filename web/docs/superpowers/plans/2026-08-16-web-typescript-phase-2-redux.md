# Web TypeScript Phase 2 Redux Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert all 14 remaining first-party Redux runtime JavaScript modules to strict TypeScript in one behavior-preserving Phase 2 delivery.

**Architecture:** Type each domain at its reducer/action boundary, reuse the existing API and redux-promise contracts, and isolate legacy plugin/store dynamism behind one explicit Redux action boundary. Execute the delivery in domain groups with focused Vite SSR tests, then migrate the root reducer, middleware, and store and regenerate the production runtime inventory.

**Tech Stack:** TypeScript 5.9.3, Redux 4.2.1, redux-promise 0.5.3, Axios, Vite 5, Node test runner, AVA, Playwright over local Chrome CDP.

## Global Constraints

- Convert exactly the 14 modules listed in `web/docs/superpowers/specs/2026-08-16-web-typescript-phase-2-redux-design.md`.
- Preserve all action strings, state fields, endpoints, request shapes, reducer transitions, exceptions, direct async behavior, and the current `news` state mutation behavior.
- Do not modify `exts/`, Server source or contracts, storage, ApiMind resources, UI behavior, or PC packaging.
- Keep `redux-promise` before `messageMiddleware` and preserve reducer HMR.
- Use `unknown` plus local narrowing; production migrations may not add `any`, `@ts-ignore`, or `@ts-nocheck`.
- Use exact compatibility aliases only; never add a generic missing `.js` to `.ts` resolver.
- Resolve dependencies only through the official npm registry; do not add a dependency unless strict typing cannot be achieved with the selected installed packages.

---

## File structure

- `web/client/reducer/types/runtime.ts`: shared `LegacyReduxAction`, recursive `DeepPartial`, `UnknownRecord`, and reducer registry contracts.
- `web/client/reducer/modules/*.ts`: state, action unions, reducers, and action creators remain colocated by domain.
- `web/client/reducer/middleware/messageMiddleware.ts`: the legacy message/error boundary.
- `web/client/reducer/modules/reducer.ts`: fixed reducer map, plugin mutation boundary, and inferred fixed `RootState`.
- `web/client/reducer/create.ts`: typed store construction and reducer HMR.
- `web/tests/support/vite-redux-runtime.mjs`: reusable Vite SSR server with deterministic virtual Axios, browser globals, Mock runtime, and plugin hook controls.
- `web/tests/redux-phase-2-*.test.mjs`: group-specific state, action, request, middleware, root reducer, and store contracts.
- `web/tests/browser/store-canary.spec.ts` plus `web/tests/fixtures/store-canary.*`: real-browser store startup proof.
- `web/tests/typescript-phase-2-redux-boundaries.test.mjs`: exact file and allowlist policy.

---

### Task 1: Establish the Phase 2 policy and deterministic Redux test runtime

**Files:**
- Create: `web/tests/typescript-phase-2-redux-boundaries.test.mjs`
- Create: `web/tests/support/vite-redux-runtime.mjs`
- Create: `web/client/reducer/types/runtime.ts`
- Modify: `web/test/register-typescript.cjs`

**Interfaces:**
- Produces: `phaseTwoReduxModules: readonly string[]` in the policy test.
- Produces: `createReduxRuntimeServer(options)` returning `{ server, axiosCalls, messages, pluginReducers, restore }`.
- Produces: `LegacyReduxAction`, `UnknownRecord`, `DeepPartial<T>`, and `LegacyReducerRegistry`.

- [ ] **Step 1: Write the failing file-boundary test**

```js
const phaseTwoReduxModules = [
  'client/reducer/create',
  'client/reducer/middleware/messageMiddleware',
  'client/reducer/modules/addInterface',
  'client/reducer/modules/docs',
  'client/reducer/modules/follow',
  'client/reducer/modules/group',
  'client/reducer/modules/interface',
  'client/reducer/modules/interfaceCol',
  'client/reducer/modules/menu',
  'client/reducer/modules/mockCol',
  'client/reducer/modules/news',
  'client/reducer/modules/project',
  'client/reducer/modules/reducer',
  'client/reducer/modules/template'
];

test('Phase 2 Redux modules are TypeScript and absent from the JavaScript allowlist', async () => {
  for (const modulePath of phaseTwoReduxModules) {
    assert.equal(await exists(resolve(webRoot, `${modulePath}.ts`)), true);
    assert.equal(await exists(resolve(webRoot, `${modulePath}.js`)), false);
    assert.equal(allowlistedPaths.has(`${modulePath}.js`), false);
  }
});
```

- [ ] **Step 2: Run the boundary test and verify RED**

Run: `node --test web/tests/typescript-phase-2-redux-boundaries.test.mjs`

Expected: FAIL because `client/reducer/create.ts` and the other Phase 2 files do not exist.

- [ ] **Step 3: Add the shared runtime contracts**

```ts
import type { Action, Reducer } from 'redux';

export type UnknownRecord = Record<string, unknown>;

export interface LegacyReduxAction extends Action<string> {
  [key: string]: unknown;
}

export type DeepPartial<T> = T extends readonly (infer U)[]
  ? DeepPartial<U>[]
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T;

export type LegacyReducerRegistry = Record<
  string,
  Reducer<unknown, LegacyReduxAction>
>;
```

- [ ] **Step 4: Add the deterministic Vite SSR helper**

Implement `createReduxRuntimeServer` with one pre-enforced virtual `axios`
module whose `get` and `post` methods append `{ method, url, configOrBody,
config }` records and return resolved Axios-shaped values. Add virtual `antd`
message methods that record `{ level, text }`, a virtual `client/plugin.js`
whose `emitHook('add_reducer', registry)` merges `pluginReducers`, the existing
Mock runtime stub, and a restorable `window.location.hash`.

```js
const runtime = await createReduxRuntimeServer({
  response: { data: { errcode: 0, errmsg: '成功', data: null } },
  locationHash: '#/group',
  pluginReducers: {}
});
const module = await runtime.server.ssrLoadModule('/client/reducer/modules/menu.ts');
```

- [ ] **Step 5: Extend only the AVA exact-path fallback list**

Add the 14 approved `.js` paths to `migratedModulePaths` in
`web/test/register-typescript.cjs`. Do not change `resolveRequestedPath` or
make fallback resolution generic.

- [ ] **Step 6: Run foundation tests**

Run: `node --test web/tests/typescript-foundation.test.mjs web/tests/typescript-phase-2-redux-boundaries.test.mjs`

Expected: the foundation test passes and the Phase 2 boundary test remains RED
until all 14 renames are complete.

- [ ] **Step 7: Commit the policy and shared harness**

```bash
git add web/client/reducer/types/runtime.ts web/test/register-typescript.cjs web/tests/support/vite-redux-runtime.mjs web/tests/typescript-phase-2-redux-boundaries.test.mjs
git commit -m "test(web): define TypeScript Redux boundary"
```

---

### Task 2: Migrate local and leaf Redux domains

**Files:**
- Rename: `web/client/reducer/modules/menu.js` → `menu.ts`
- Rename: `web/client/reducer/modules/addInterface.js` → `addInterface.ts`
- Rename: `web/client/reducer/modules/follow.js` → `follow.ts`
- Create: `web/tests/redux-phase-2-leaf.test.mjs`
- Modify: explicit first-party imports of these modules where required.

**Interfaces:**
- Produces: `MenuState`, `AddInterfaceState`, `FollowState`.
- Produces: named `menuReducer`, `addInterfaceReducer`, `followReducer`, each retained as the default export.
- Preserves: `changeMenuItem`, all add-interface local action creators, `fetchInterfaceProject`, `addInterfaceClipboard`, `getFollowList`, `addFollow`, and `delFollow`.

- [ ] **Step 1: Write failing leaf-domain tests**

Cover `#/group` menu initialization, `changeMenuItem`, every add-interface
synchronous state field, the clipboard function identity, project response
unwrapping, follow response unwrapping, and exact Axios calls.

```js
const changed = menu.menuReducer(menu.initialState, menu.changeMenuItem('/project'));
assert.equal(changed.curKey, '/project');

const projectAction = addInterface.fetchInterfaceProject(7);
assert.deepEqual(runtime.axiosCalls.at(-1), {
  method: 'get',
  url: '/api/project/get',
  configOrBody: { params: { id: 7 } },
  config: undefined
});

const followAction = follow.getFollowList(9);
assert.equal(followAction.type, follow.actionTypes.GET_FOLLOW_LIST);
```

- [ ] **Step 2: Run the leaf tests and verify RED**

Run: `node --test web/tests/redux-phase-2-leaf.test.mjs`

Expected: FAIL because the TypeScript leaf modules and named exports are absent.

- [ ] **Step 3: Rename and type the leaf modules**

Use literal action type objects and discriminated unions. Model clipboard as
`() => void`, identifiers as `string | number`, sequence headers with
`id/name/value`, and project/follow response data only to the fields read by
reducers and existing consumers.

```ts
export const actionTypes = {
  CHANGE_MENU_ITEM: 'yapi/menu/CHANGE_MENU_ITEM'
} as const;

export function menuReducer(
  state: MenuState = initialState,
  action: MenuAction
): MenuState {
  return action.type === actionTypes.CHANGE_MENU_ITEM
    ? { ...state, curKey: action.data }
    : state;
}

export default menuReducer;
```

- [ ] **Step 4: Run focused tests and strict typecheck**

Run: `node --test web/tests/redux-phase-2-leaf.test.mjs && npm --prefix web run typecheck`

Expected: leaf tests pass and TypeScript reports zero diagnostics.

- [ ] **Step 5: Commit the leaf domains**

```bash
git add web/client/reducer/modules web/client/components web/client/containers web/tests/redux-phase-2-leaf.test.mjs
git commit -m "refactor(web): type leaf Redux domains"
```

---

### Task 3: Migrate content and compatibility Redux domains

**Files:**
- Rename: `web/client/reducer/modules/docs.js` → `docs.ts`
- Rename: `web/client/reducer/modules/template.js` → `template.ts`
- Rename: `web/client/reducer/modules/news.js` → `news.ts`
- Rename: `web/client/reducer/modules/mockCol.js` → `mockCol.ts`
- Create: `web/tests/redux-phase-2-content.test.mjs`
- Modify: exact first-party imports where required.

**Interfaces:**
- Produces: `DocsState`, `TemplateState`, `NewsState`, `MockColState` and narrow data records.
- Preserves all existing content action creators and direct async `fetchMockCol`.
- Preserves `news` list mutation, sorting, append order, `curpage` mutation, and empty-page behavior.

- [ ] **Step 1: Write failing content-domain tests**

```js
const initialList = [{ add_time: 1 }];
const state = { newsData: { list: initialList, total: 1 }, curpage: 1 };
const next = news.newsReducer(state, resolved(news.actionTypes.FETCH_MORE_NEWS, {
  list: [{ add_time: 3 }],
  total: 2
}));
assert.equal(next.newsData.list, initialList);
assert.deepEqual(initialList.map(item => item.add_time), [3, 1]);
assert.equal(state.curpage, 2);

const updated = template.templateReducer(template.initialState, resolved(
  template.actionTypes.UPDATE_TEMPLATE,
  { key: 'base', name: 'Updated' }
));
assert.equal(updated.current.key, 'base');
```

Also assert every docs/template/news URL, params/body, the default
`variable.PAGE_LIMIT`, double `encodeURI` Swagger-adjacent behavior where used,
and `fetchMockCol` returning an awaited action with `result.data` as payload.

- [ ] **Step 2: Run the content tests and verify RED**

Run: `node --test web/tests/redux-phase-2-content.test.mjs`

Expected: FAIL because the `.ts` modules and named contracts do not exist.

- [ ] **Step 3: Rename and type docs and template**

Use `ApiResponse<DocRecord[]>`, `ApiResponse<DocRecord>`,
`ApiResponse<TemplateRecord[]>`, and `ApiResponse<TemplateRecord>`. Keep
document payloads and template query/update inputs as focused records with
unknown additional fields.

- [ ] **Step 4: Rename and type news without removing mutation**

```ts
case FETCH_MORE_NEWS: {
  const list = action.payload.data.data.list;
  state.newsData.list.push(...list);
  state.newsData.list.sort((a, b) => b.add_time - a.add_time);
  if (list && list.length) state.curpage++;
  return {
    ...state,
    newsData: { total: action.payload.data.data.total, list: state.newsData.list }
  };
}
```

The code above intentionally preserves the approved historical behavior.

- [ ] **Step 5: Rename and type mockCol**

Keep `/api/plugin/advmock/case/list?interface_id=` unchanged and type the
awaited result separately from redux-promise actions. Do not edit the extension.

- [ ] **Step 6: Run focused, AVA compatibility, and type tests**

Run: `node --test web/tests/redux-phase-2-content.test.mjs && npm --prefix web test -- --match='common › advanced-mock › *' && npm --prefix web run typecheck`

Expected: all selected tests pass and TypeScript reports zero diagnostics.

- [ ] **Step 7: Commit content domains**

```bash
git add web/client/reducer/modules web/client/components web/client/containers web/tests/redux-phase-2-content.test.mjs
git commit -m "refactor(web): type content Redux domains"
```

---

### Task 4: Migrate interface Redux domains

**Files:**
- Rename: `web/client/reducer/modules/interface.js` → `interface.ts`
- Rename: `web/client/reducer/modules/interfaceCol.js` → `interfaceCol.ts`
- Create: `web/tests/redux-phase-2-interface.test.mjs`
- Modify: explicit first-party imports where required.

**Interfaces:**
- Produces: `InterfaceState`, `InterfaceColState`, list response types, case/environment records, and named reducers.
- Preserves: all synchronous actions; all direct async action creators; `qs.stringify(params, { indices: false })`; the current non-awaited Axios value in `fetchInterfaceCatList` before action return.

- [ ] **Step 1: Write failing interface-domain tests**

Test all reducer branches and exact request construction. Explicitly lock the
legacy async distinction:

```js
const listAction = await inter.fetchInterfaceList({ project_id: 7, tag: ['a', 'b'] });
assert.equal(listAction.type, inter.actionTypes.FETCH_INTERFACE_LIST);
assert.equal(runtime.axiosCalls.at(-1).url, '/api/interface/list');
assert.equal(
  runtime.axiosCalls.at(-1).configOrBody.paramsSerializer({ tag: ['a', 'b'] }),
  'tag=a&tag=b'
);

const categoryAction = await inter.fetchInterfaceCatList({ project_id: 7 });
assert.equal(categoryAction.payload instanceof Promise, true);
```

- [ ] **Step 2: Run the interface tests and verify RED**

Run: `node --test web/tests/redux-phase-2-interface.test.mjs`

Expected: FAIL because the TypeScript modules and named exports are absent.

- [ ] **Step 3: Rename and type interface state/actions**

Use separate resolved-action contracts for `FETCH_INTERFACE_DATA`, list menu,
total list, and category list. Preserve the typo `updata`, `payload: true`,
direct query-string concatenation, and direct async returns.

- [ ] **Step 4: Rename and type interface collection state/actions**

Model collection, case, environment, and variable records only to fields in
the initial state and current consumers. `setColData` accepts
`Partial<InterfaceColState>` and spreads it exactly as before.

- [ ] **Step 5: Run focused tests, typecheck, and production build**

Run: `node --test web/tests/redux-phase-2-interface.test.mjs && npm --prefix web run typecheck && npm --prefix web run build`

Expected: tests, strict typecheck, and Vite build pass.

- [ ] **Step 6: Commit interface domains**

```bash
git add web/client/reducer/modules web/client/components web/client/containers web/tests/redux-phase-2-interface.test.mjs
git commit -m "refactor(web): type interface Redux domains"
```

---

### Task 5: Migrate organization Redux domains

**Files:**
- Rename: `web/client/reducer/modules/group.js` → `group.ts`
- Rename: `web/client/reducer/modules/project.js` → `project.ts`
- Create: `web/tests/redux-phase-2-organization.test.mjs`
- Modify: exact first-party imports where required.

**Interfaces:**
- Produces: `GroupState`, `ProjectState`, group/project/member/environment request and response records, and named reducers.
- Preserves: every existing action creator and endpoint, including `GET_PEOJECT_MEMBER`, `strice`, `upsetProject`, `project_id`, direct async project actions, and double-encoded Swagger URL.

- [ ] **Step 1: Write failing organization-domain tests**

Cover every reducer branch plus request construction. Lock legacy spellings and
encoding:

```js
project.handleSwaggerUrlData('https://example.invalid/a b?x=1');
assert.equal(
  runtime.axiosCalls.at(-1).url,
  '/api/project/swagger_url?url=' + encodeURI(encodeURI('https://example.invalid/a b?x=1'))
);

const updated = group.groupReducer(group.initialState, resolved(
  group.actionTypes.FETCH_GROUP_MSG,
  { role: 'owner', group_name: 'G', group_desc: '', custom_field1: { name: 'Tier', enable: true } }
));
assert.deepEqual(updated.field, { name: 'Tier', enable: true });
```

- [ ] **Step 2: Run the organization tests and verify RED**

Run: `node --test web/tests/redux-phase-2-organization.test.mjs`

Expected: FAIL because the TypeScript modules and named contracts are absent.

- [ ] **Step 3: Rename and type group**

Model `GroupRecord`, `GroupMember`, `GroupCustomField`, state, resolved actions,
and mutation-free synchronous `UPDATE_GROUP_LIST`. Preserve the existing
`console.log(action.payload)` in `FETCH_GROUP_MSG`; its removal is a behavior
cleanup outside this phase.

- [ ] **Step 4: Rename and type project**

Model only current state/consumer fields and input records. Keep action creators
that the reducer ignores, and retain the exact distinction between promise
payloads and direct async returned actions.

- [ ] **Step 5: Run focused tests, full Node tests, and typecheck**

Run: `node --test web/tests/redux-phase-2-organization.test.mjs && node --test web/tests/*.test.mjs && npm --prefix web run typecheck`

Expected: all tests pass and TypeScript reports zero diagnostics.

- [ ] **Step 6: Commit organization domains**

```bash
git add web/client/reducer/modules web/client/components web/client/containers web/tests/redux-phase-2-organization.test.mjs
git commit -m "refactor(web): type organization Redux domains"
```

---

### Task 6: Migrate Redux middleware, root reducer, and store

**Files:**
- Rename: `web/client/reducer/middleware/messageMiddleware.js` → `messageMiddleware.ts`
- Rename: `web/client/reducer/modules/reducer.js` → `reducer.ts`
- Rename: `web/client/reducer/create.js` → `create.ts`
- Create: `web/tests/redux-phase-2-infrastructure.test.mjs`
- Modify: `web/client/index.jsx`
- Modify: `web/vite.config.mjs`

**Interfaces:**
- Produces: typed `messageMiddleware`, `fixedReducerModules`, `rootReducer`, `RootState`, `AppStore`, and `createStore(initialState?: DeepPartial<RootState>)`.
- Preserves: middleware behavior/order, fixed state keys, plugin registry mutation, and reducer HMR.

- [ ] **Step 1: Write failing middleware and root/store tests**

```js
assert.equal(messageMiddleware()(() => 'next-result')({ type: 'ok' }), 'next-result');
assert.equal(messageMiddleware()(() => 'unused')(null), undefined);
assert.throws(
  () => messageMiddleware()(() => 'unused')({
    type: 'failed',
    payload: { data: { errcode: 400, errmsg: '失败' } }
  }),
  /失败/
);

assert.deepEqual(Object.keys(root.fixedReducerModules), [
  'group', 'user', 'inter', 'interfaceCol', 'project', 'news',
  'addInterface', 'menu', 'follow', 'mockCol', 'template', 'docs'
]);
const store = create.default({ menu: { curKey: '/typed' } });
assert.equal(store.getState().menu.curKey, '/typed');
```

Also assert `40011` passes through, error payload messages, generic server
errors, plugin reducer initialization, and middleware order by dispatched
promise behavior.

- [ ] **Step 2: Run infrastructure tests and verify RED**

Run: `node --test web/tests/redux-phase-2-infrastructure.test.mjs`

Expected: FAIL because the three TypeScript modules and named exports are absent.

- [ ] **Step 3: Rename and type messageMiddleware**

Use `Middleware<unknown, RootState>` only where Redux 4 signatures preserve the
legacy falsy-action test; otherwise expose the same curried function with
`LegacyReduxAction | null | undefined` and a typed `next` callback. Narrow
payload data with an `isRecord` helper and keep all branch ordering unchanged.

- [ ] **Step 4: Rename and type root reducer with an open plugin boundary**

```ts
export const fixedReducerModules = {
  group,
  user,
  inter,
  interfaceCol,
  project,
  news,
  addInterface,
  menu,
  follow,
  mockCol,
  template,
  docs
};

export type RootState = {
  [K in keyof typeof fixedReducerModules]: ReturnType<
    (typeof fixedReducerModules)[K]
  >;
};

const reducerModules = {
  ...fixedReducerModules
} as typeof fixedReducerModules & LegacyReducerRegistry;
emitHook('add_reducer', reducerModules);
export const rootReducer = combineReducers(reducerModules);
export default rootReducer;
```

The mapped `RootState` remains the exact fixed first-party state. The
`LegacyReducerRegistry` intersection permits runtime plugin keys without
claiming those keys as statically known.

- [ ] **Step 5: Rename and type store creation/HMR**

Use the installed Redux 4 store and preloaded-state types. Keep
`applyMiddleware(promiseMiddleware, messageMiddleware)` in that order. Narrow
the HMR callback module to `{ default?: typeof rootReducer }` and retain the
legacy module fallback.

- [ ] **Step 6: Add exact Vite compatibility aliases**

Add aliases for only Phase 2 `.js` imports that remain in deferred extension or
test consumers. Change first-party imports to extensionless paths. Keep the
existing Phase 1 aliases before broad `client` and `common` aliases.

- [ ] **Step 7: Run infrastructure, full Web, and build tests**

Run: `node --test web/tests/redux-phase-2-infrastructure.test.mjs && make test-web && make build-web`

Expected: infrastructure tests, Node tests, AVA tests, lint, strict typecheck,
and production build pass.

- [ ] **Step 8: Commit Redux infrastructure**

```bash
git add web/client/index.jsx web/client/reducer web/vite.config.mjs web/tests/redux-phase-2-infrastructure.test.mjs
git commit -m "refactor(web): type Redux store infrastructure"
```

---

### Task 7: Add browser startup proof and accept the complete migration

**Files:**
- Create: `web/tests/browser/store-canary.spec.ts`
- Create: `web/tests/fixtures/store-canary.html`
- Create: `web/tests/fixtures/store-canary.tsx`
- Modify: `web/scripts/typescript/runtime-js-allowlist.json`
- Create: `web/docs/superpowers/reports/2026-08-16-typescript-phase-2-redux-results.md`

**Interfaces:**
- Consumes: `createStore`, `RootState`, and the complete migrated reducer layer.
- Produces: a browser-visible list of initialized fixed reducer keys and final runtime inventory evidence.

- [ ] **Step 1: Write the browser store canary**

```tsx
import createStore from '../../client/reducer/create';

const store = createStore();
const keys = Object.keys(store.getState()).sort();
container.dataset.testid = 'store-keys';
container.textContent = keys.join(',');
```

The Playwright spec expects exactly the 12 fixed root keys and installs the
existing console guard before navigation.

- [ ] **Step 2: Run only the store canary with local Chrome/CDP**

Run: `npm --prefix web run test:browser -- tests/browser/store-canary.spec.ts`

Expected: PASS using the repository CDP launcher and the user's local Chrome.

- [ ] **Step 3: Build and regenerate the runtime inventory**

Run: `npm --prefix web run inventory:runtime -- --write-baseline`

Expected: all 14 Phase 2 JavaScript entries are removed, with zero violations
and zero stale entries. `extension-compat` remains unchanged.

- [ ] **Step 4: Run the Phase 2 policy and unsafe-escape checks**

```bash
node --test web/tests/typescript-phase-2-redux-boundaries.test.mjs
rg -n '\bany\b|@ts-ignore|@ts-nocheck' \
  web/client/reducer/create.ts \
  web/client/reducer/middleware/messageMiddleware.ts \
  web/client/reducer/modules/{addInterface,docs,follow,group,interface,interfaceCol,menu,mockCol,news,project,reducer,template}.ts
```

Expected: policy test passes and `rg` returns no matches.

- [ ] **Step 5: Run the complete deterministic matrix**

```bash
node scripts/verify-docs.mjs scripts/verify-docs.config.json
make test-web
make build-web
make test-web-browser
```

Expected: documentation, Node, AVA, lint, strict typecheck, production build,
runtime inventory, and all local Chrome/CDP tests pass.

- [ ] **Step 6: Run isolated live authentication**

```bash
APIMIND_DEFAULT_PASSWORD=pilot-local-password \
APIMIND_LIVE_SERVER_PORT=18890 \
APIMIND_LIVE_WEB_PORT=4002 \
make test-web-browser-live
```

Expected: one live login test passes and its uniquely named Compose resources,
Chrome process, and ports are cleaned up.

- [ ] **Step 7: Record measured evidence**

Write the results report with the exact commit range, before/after source and
allowlist counts, zero-diagnostic and unsafe-escape results, dependency changes
or explicit absence of changes, focused/full/browser/live test counts, build
warnings, review findings, unchanged boundaries, and Phase 3 recommendation.

- [ ] **Step 8: Verify final documentation and commit evidence**

```bash
node scripts/verify-docs.mjs scripts/verify-docs.config.json
git diff --check
git add web/scripts/typescript/runtime-js-allowlist.json web/tests/browser/store-canary.spec.ts web/tests/fixtures/store-canary.html web/tests/fixtures/store-canary.tsx web/docs/superpowers/reports/2026-08-16-typescript-phase-2-redux-results.md
git commit -m "docs(web): record TypeScript Redux migration"
```
