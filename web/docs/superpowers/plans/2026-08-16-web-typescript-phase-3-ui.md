# Web TypeScript Phase 3 UI Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> `superpowers:executing-plans` to implement this plan task-by-task. Repository
> instructions prohibit subagents, so do not use
> `superpowers:subagent-driven-development`. Steps use checkbox (`- [ ]`)
> syntax for tracking.

**Goal:** Convert the 85 baseline `migration-target` modules and their three
additional first-party production-closure modules to strict TypeScript while
preserving runtime behavior.

**Architecture:** Drive the migration from one canonical 88-entry source-to-
target map and validate its production import closure before every wave. Move
modules through five dependency-closed waves, reuse the typed API and Redux
boundaries from Phases 1-2, and keep legacy class components, decorators,
lifecycles, mutations, and error behavior intact. Use Node/AVA for deterministic
logic contracts and the existing Vite plus local Chrome/CDP harness for DOM,
editor, routing, and application behavior.

**Tech Stack:** TypeScript 5.9.3, React 18.3.1, React Router 5.3.4, Redux 4.2.1,
Ant Design 6.4.3, Vite 5.2, Node test runner, AVA 2.4, Playwright 1.62 over the
user's local Chrome CDP endpoint.

## Global Constraints

- Use commit `fd06247` as the source migration baseline and the reviewed Phase
  3 design at `web/docs/superpowers/specs/2026-08-16-web-typescript-phase-3-ui-design.md` as the scope authority.
- Migrate exactly 88 modules: 85 baseline `migration-target` entries plus
  `client/components/index.js`, `client/containers/index.js`, and
  `client/shims/tui-editor.js`.
- Preserve runtime behavior, including class components, decorators, lifecycle
  order, request timing, mutation, callback identity, form serialization,
  errors, rejected promises, editor timing, and plugin hooks.
- Do not modify source under `web/exts/`; deferred extension code receives only
  exact Vite compatibility mappings owned outside `exts/`.
- Do not modify Server contracts, storage, ApiMind resources, or PC packaging.
- WebUI must continue to reach business APIs through the local Go service; do
  not add direct remote ApiMind, YApi, or business API calls.
- Production migrations may not add `any`, `@ts-ignore`, or `@ts-nocheck`.
  Dynamic input enters as `unknown` and is narrowed at the smallest boundary.
- Keep shared types local until the same stable structure is consumed by at
  least three runtime modules. Do not create a universal domain entity model.
- Do not upgrade React, React Router, Redux, Ant Design, or another UI runtime.
  Add a declaration dependency only from the official npm registry and only
  when bundled declarations and a narrow local declaration are insufficient.
- Do not add a generic missing-JavaScript-to-TypeScript resolver.
- Do not use subagents. Perform migration, review, and verification in the
  primary session.
- Execute in an isolated `codex/` worktree created at implementation time. Do
  not package or build a desktop application bundle.

---

## File structure

- `web/scripts/typescript/phase3-module-map.json`: the canonical 88-entry
  `{ source, target, wave }` migration map.
- `web/scripts/typescript/phase3-module-policy.mjs`: map, production closure,
  extension, and forward-wave dependency validation.
- `web/tests/typescript-phase-3-policy.test.mjs`: incremental wave-state and
  final-scope policy, including unsafe escape and legacy import rejection.
- `web/test/typescript-loader.cjs`: reusable exact-path TypeScript/TSX loader
  implementation.
- `web/test/register-typescript.cjs`: AVA bootstrap that composes existing
  Phase 1-2 mappings with the Phase 3 map.
- `web/test/typescript-loader.test.js`: `.ts`, `.tsx`, decorator, and rejected
  unmapped-path loader contracts.
- `web/tests/fixtures/phase3-shared-ui.*`: deterministic Loading and
  confirmation lifecycle browser fixture.
- `web/tests/browser/phase3-shared-ui.spec.ts`: shared UI DOM/event checks.
- `web/tests/fixtures/phase3-project-core.*`: real Toast UI editor mounting,
  save serialization, and unmount fixture.
- `web/tests/browser/phase3-project-core.spec.ts`: Project-core browser checks.
- `web/client/containers/Project/Interface/InterfaceList/requestContracts.ts`:
  behavior-preserving request descriptors for direct UI Axios calls.
- `web/client/containers/Project/Interface/interfaceRoute.ts`: pure Interface
  route selection without loading the browser-only Project tree.
- `web/tests/typescript-phase-3-routing.test.mjs`: Interface route selection and
  fallback behavior through Vite SSR.
- `web/docs/superpowers/reports/2026-08-16-typescript-phase-3-ui-results.md`:
  measured final evidence and Phase 4 recommendation.

The five module-map waves contain 13, 20, 22, 27, and 6 modules respectively.
The exact source and target paths are the rename lists in Tasks 2-6.

---

### Task 1: Establish the canonical module map, policy, and TSX test loader

**Files:**
- Create: `web/scripts/typescript/phase3-module-map.json`
- Create: `web/scripts/typescript/phase3-module-policy.mjs`
- Create: `web/tests/typescript-phase-3-policy.test.mjs`
- Create: `web/test/typescript-loader.cjs`
- Create: `web/test/typescript-loader.test.js`
- Modify: `web/test/register-typescript.cjs`
- Modify: `web/package.json`

**Interfaces:**
- Produces: `PhaseThreeModuleEntry` with `source: string`, `target: string`, and
  `wave: 1 | 2 | 3 | 4 | 5`.
- Produces: `loadPhaseThreeModuleMap(webRoot)`,
  `collectProductionClosure(webRoot, map)`, and
  `validatePhaseThreeModuleMap(webRoot, map)` from
  `phase3-module-policy.mjs`.
- Produces: `scanCompletedTargets(webRoot, map, completedWave)` returning
  `unsafeEscapeMatches`, `legacyCompletedSourceSpecifiers`, and
  `excludedSourceChanges`.
- Produces: `createMappedResolver(mapping)`, `compileTypeScript(source,
  filename)`, and `registerTypeScriptLoader(mapping)` from
  `typescript-loader.cjs`.
- Consumes: all exact rename pairs in Tasks 2-6 and the production entry
  `client/index.jsx`.

- [ ] **Step 1: Write the failing Phase 3 policy tests**

The test must assert:

```js
assert.equal(map.version, 1);
assert.equal(map.baseline, 'fd06247');
assert.equal(map.entry, 'client/index.jsx');
assert.equal(map.entries.length, 88);
assert.deepEqual(countByWave(map.entries), [13, 20, 22, 27, 6]);
assert.deepEqual(validation.duplicateSources, []);
assert.deepEqual(validation.duplicateTargets, []);
assert.deepEqual(validation.forwardWaveEdges, []);
assert.deepEqual(validation.unmappedReachableJavaScript, []);
assert.deepEqual(validation.unexpectedExcludedReachability, []);
```

Use `PHASE3_COMPLETED_WAVE`, defaulting to `0`, to assert incremental state:

```js
const completedWave = Number(process.env.PHASE3_COMPLETED_WAVE || 0);
for (const entry of map.entries) {
  const migrated = entry.wave <= completedWave;
  assert.equal(await exists(resolve(webRoot, entry.source)), !migrated);
  assert.equal(await exists(resolve(webRoot, entry.target)), migrated);
}

const completedValidation = await scanCompletedTargets(
  webRoot,
  map,
  completedWave
);
assert.deepEqual(completedValidation.unsafeEscapeMatches, []);
assert.deepEqual(completedValidation.legacyCompletedSourceSpecifiers, []);
assert.deepEqual(completedValidation.excludedSourceChanges, []);
```

- [ ] **Step 2: Run the policy test and verify RED**

Run: `node --test web/tests/typescript-phase-3-policy.test.mjs`

Expected: FAIL because the module map and policy module do not exist.

- [ ] **Step 3: Add the complete 88-entry module map**

Use this schema and every exact rename in Tasks 2-6:

```json
{
  "version": 1,
  "baseline": "fd06247",
  "entry": "client/index.jsx",
  "entries": [
    {
      "source": "client/shims/reactRoot.js",
      "target": "client/shims/reactRoot.ts",
      "wave": 1
    }
  ]
}
```

Sort entries by wave and then source path. Do not include
`client/plugin-module.js`, `exts/`, or the 18 Appendix A exclusions from the
design.

- [ ] **Step 4: Implement the production-closure and wave validator**

Use TypeScript's `preProcessFile` to follow static imports, re-exports,
`require('literal')`, and `import('literal')`. Resolve relative imports plus
the `client/`, `common/`, and `exts/` aliases with `.js`, `.jsx`, `.ts`, `.tsx`,
and `index.*` candidates. When both a legacy source and migrated target are
possible, first normalize the literal specifier to its repository path, then
look it up by `entry.source`. If the source no longer exists, resolve to that
entry's exact `target`; never form names such as `Component.js.tsx`. Record the
original `.js` literal in `legacyCompletedSourceSpecifiers` even when map-based
resolution reaches the target successfully.

```js
export function validatePhaseThreeModuleMap(webRoot, map) {
  return {
    duplicateSources,
    duplicateTargets,
    invalidExtensions,
    invalidWaveCounts,
    forwardWaveEdges,
    unmappedReachableJavaScript,
    unexpectedExcludedReachability,
    unsafeEscapeMatches,
    legacyCompletedSourceSpecifiers,
    excludedSourceChanges
  };
}
```

Permit reachable JavaScript only for `client/plugin-module.js` and paths under
`exts/`. Treat an Appendix A path becoming reachable as
`unexpectedExcludedReachability`, not as an automatic scope expansion.

For completed map entries, scan the target text for the exact patterns
`\bany\b`, `@ts-ignore`, and `@ts-nocheck`. Also scan every module in the
production closure, including already migrated Phase 0-2 TypeScript and
not-yet-migrated later-wave JavaScript, for a literal import resolving to a
completed legacy source path. Report those specifiers so each wave rewrites
production consumers to extensionless imports. Exclude Appendix A and `exts/`
source from rewrites; extension compatibility remains alias-driven.

Keep the 18 Appendix A paths as an exact constant in the policy module. Read
their baseline bytes with `git show fd06247:web/<path>` and compare them with
the worktree. Report any difference as `excludedSourceChanges`.

- [ ] **Step 5: Refactor the AVA loader around exact source-to-target maps**

Move loader mechanics into `test/typescript-loader.cjs`. Preserve the existing
Phase 1-2 `.js` → `.ts` entries and merge the 88 Phase 3 entries by absolute
source path.

```js
function compileTypeScript(source, filename) {
  return ts.transpileModule(source, {
    fileName: filename,
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.React,
      esModuleInterop: true,
      experimentalDecorators: true,
      useDefineForClassFields: false
    }
  }).outputText;
}

for (const extension of ['.ts', '.tsx']) {
  require.extensions[extension] = compileRegisteredModule;
}
```

The resolver must retry only when the requested absolute legacy path exists in
the merged map. An unmapped missing `.js` request must rethrow the original
resolution error.

- [ ] **Step 6: Add loader regression tests**

Test the exported pure functions with inline TypeScript and TSX source. Assert
that TSX emits `React.createElement`, a decorated class transpiles, the mapped
target preserves `.tsx`, and an unmapped request returns no fallback target.

Add one real loader integration test. Create a temporary directory, write only
`component.tsx` with this source, map an absent `component.js` path to it, and
spawn Node with the Web directory as `cwd`:

```tsx
const React = {
  createElement(type: string, _props: unknown, ...children: unknown[]) {
    return { type, children };
  }
};
export default <span>loaded</span>;
```

The child calls `registerTypeScriptLoader(injectedMap)`, `require`s the legacy
`.js` path, and asserts the default export equals
`{ type: 'span', children: ['loaded'] }`. A second child requires an unmapped
missing `.js` path and must exit with `MODULE_NOT_FOUND`. Remove the temporary
directory in `finally` and restore the Node resolver/extensions after each
in-process unit test.

Run: `npm --prefix web test -- --match='typescript loader › *'`

Expected: all loader tests pass.

- [ ] **Step 7: Add the policy command and verify GREEN at wave zero**

Add:

```json
"test:phase3:policy": "node --test tests/typescript-phase-3-policy.test.mjs"
```

Run:

```bash
npm --prefix web run test:phase3:policy
npm --prefix web test -- --match='typescript loader › *'
npm --prefix web run typecheck
git diff --check
```

Expected: the map, graph, loader, and current TypeScript tree pass with
`PHASE3_COMPLETED_WAVE=0`.

- [ ] **Step 8: Commit policy infrastructure**

```bash
git add web/scripts/typescript/phase3-module-map.json web/scripts/typescript/phase3-module-policy.mjs web/tests/typescript-phase-3-policy.test.mjs web/test/typescript-loader.cjs web/test/typescript-loader.test.js web/test/register-typescript.cjs web/package.json
git commit -m "test(web): define TypeScript UI migration boundary"
```

---

### Task 2: Wave 1 — migrate foundations, shims, plugin, and pure adapters

**Files:**
- Rename: `web/client/components/AceEditor/mockEditor.js` → `mockEditor.ts`
- Rename: `web/client/components/Docs/markdownHeadings.js` → `markdownHeadings.ts`
- Rename: `web/client/containers/Project/Setting/ProjectData/exporters.js` → `exporters.ts`
- Rename: `web/client/containers/Project/Setting/ProjectData/importers.js` → `importers.ts`
- Rename: `web/client/containers/Project/Setting/settingTabs.js` → `settingTabs.ts`
- Rename: `web/client/plugin.js` → `plugin.ts`
- Rename: `web/client/shims/Collapse.js` → `Collapse.tsx`
- Rename: `web/client/shims/LocaleProvider.js` → `LocaleProvider.tsx`
- Rename: `web/client/shims/antdIcon.js` → `antdIcon.tsx`
- Rename: `web/client/shims/moment.js` → `moment.ts`
- Rename: `web/client/shims/react-is.js` → `react-is.ts`
- Rename: `web/client/shims/reactRoot.js` → `reactRoot.ts`
- Rename: `web/client/shims/tui-editor.js` → `tui-editor.ts`
- Create: `web/client/plugin-module.d.ts`
- Create: `web/tests/typescript-phase-3-foundation.test.mjs`
- Create: `web/tests/fixtures/phase3-react-root.html`
- Create: `web/tests/fixtures/phase3-react-root.tsx`
- Create: `web/tests/browser/phase3-react-root.spec.ts`
- Modify: `web/vite.config.mjs`
- Modify: exact first-party imports of the renamed modules.

**Interfaces:**
- Produces: `renderInto(container: Element, element: ReactNode): Root` and
  `unmountFrom(container: Element): void`.
- Produces: typed legacy `Collapse`, `LocaleProvider`, `Icon`, Moment,
  `react-is`, and Toast UI Editor adapters without changing runtime exports.
- Produces: plugin `bind`, `emitHook`, `ready`, and default plugin object with
  existing single-listener, multi-listener, component, error, and readiness
  behavior.
- Produces: exact import/export descriptors, setting tabs, Markdown heading
  helpers, and Ace mock-editor contracts.

- [ ] **Step 1: Lock the current foundation behavior**

Add tests for:

- plugin unknown-hook error text `不存在的hook name`;
- multi-listener `Promise.all` ordering and single component listener identity;
- plugin `ready` resolving `true` after the generated registry loads;
- `markdownHeadings`, exporters, importers, and setting tab output remaining
  byte-for-byte equivalent for existing fixtures.

Load `client/plugin.js` through a Vite SSR server with one pre-enforced virtual
boundary that matches only its resolved `client/plugin-module.js` import and
returns `export default Promise.resolve({})`. For the failure case, return
`export default Promise.reject(new Error('registry failed'))` and assert
`ready === false`. Do not evaluate real extension modules in this Node test.

Run:

```bash
node --test web/tests/typescript-phase-3-foundation.test.mjs
npm --prefix web test -- --match='common › docs markdown headings › *' --match='common › project data config › *' --match='plugin registry › *'
```

Expected: the behavior tests pass against JavaScript.

Add a browser fixture for `reactRoot` because the repository intentionally has
no Node DOM renderer. Render `first`, call `renderInto` again with `second`, and
store whether both calls returned the same Root in
`window.__phase3SameRoot`. Add a `data-testid="unmount-root"` button that calls
`unmountFrom(container)`. The Playwright test installs `installConsoleGuard`,
asserts the same Root was reused, asserts `second` is visible, clicks unmount,
and asserts the container is empty with no console or page errors.

Run: `npm --prefix web run test:browser -- tests/browser/phase3-react-root.spec.ts`

Expected: PASS against the JavaScript shim.

- [ ] **Step 2: Verify the Wave 1 boundary is RED**

Run: `PHASE3_COMPLETED_WAVE=1 npm --prefix web run test:phase3:policy`

Expected: FAIL because all 13 Wave 1 `.js` sources still exist and their
TypeScript targets do not.

- [ ] **Step 3: Rename the 13 files and add narrow types**

Use `git mv`. Keep component structure and exports unchanged. Representative
contracts:

```ts
type HookListener = (...args: unknown[]) => unknown;
type Hook =
  | { type: 'component'; mulit: false; listener: unknown }
  | { type: 'listener'; mulit: false; listener: HookListener | null }
  | { type: 'listener'; mulit: true; listener: HookListener[] };

const roots = new WeakMap<Element, Root>();

export function renderInto(container: Element, element: ReactNode): Root {
  let root = roots.get(container);
  if (!root) {
    root = createRoot(container);
    roots.set(container, root);
  }
  root.render(element);
  return root;
}
```

For third-party adapters, prefer official bundled types. If the exact legacy
export surface is missing, define a narrow local intersection instead of using
`any`.

Rewrite every production-closure consumer reported by
`legacyCompletedSourceSpecifiers` to an extensionless import, including
later-wave JavaScript. Do not edit Appendix A or `exts/` source.

- [ ] **Step 4: Type the generated plugin boundary**

`plugin-module.d.ts` must declare a default
`Promise<Record<string, { module: unknown; options: unknown } | null>>`.
`plugin.ts` narrows `module` to a callable value immediately before `.call` and
must preserve ignored failures and `readyResolve(false)`.

- [ ] **Step 5: Add exact Vite compatibility aliases**

Update the existing `moment` and `react-is` aliases to their `.ts` targets. Add
one exact regex alias for legacy imports ending in
`client/shims/tui-editor.js`, targeting `client/shims/tui-editor.ts`. Keep all
exact aliases before broad `client`, `common`, and `exts` aliases. Do not edit
`web/exts/yapi-plugin-wiki/wikiPage/Editor.js`.

- [ ] **Step 6: Verify Wave 1 GREEN**

```bash
PHASE3_COMPLETED_WAVE=1 npm --prefix web run test:phase3:policy
node --test web/tests/typescript-phase-3-foundation.test.mjs
npm --prefix web test
npm --prefix web run typecheck
npm --prefix web run build
npm --prefix web run test:browser -- tests/browser/phase3-react-root.spec.ts
git diff --check
```

Expected: policy, behavior, AVA, typecheck, production build, and the real
Chrome root lifecycle test pass. The policy test reports no unsafe escapes or
legacy completed-source imports.

- [ ] **Step 7: Commit Wave 1**

```bash
git status --short
git add web/client web/vite.config.mjs web/tests/typescript-phase-3-foundation.test.mjs web/tests/fixtures/phase3-react-root.html web/tests/fixtures/phase3-react-root.tsx web/tests/browser/phase3-react-root.spec.ts
git diff --cached --check
git commit -m "refactor(web): type UI foundations and adapters"
```

---

### Task 3: Wave 2 — migrate dependency-free shared UI

**Files:**
- Rename: `web/client/components/AceEditor/AceEditor.js` → `AceEditor.tsx`
- Rename: `web/client/components/Breadcrumb/Breadcrumb.js` → `Breadcrumb.tsx`
- Rename: `web/client/components/CaseEnv/index.js` → `index.tsx`
- Rename: `web/client/components/Docs/DocsWorkspace.js` → `DocsWorkspace.tsx`
- Rename: `web/client/components/Docs/MarkdownRawEditor.js` → `MarkdownRawEditor.tsx`
- Rename: `web/client/components/EasyDragSort/EasyDragSort.js` → `EasyDragSort.tsx`
- Rename: `web/client/components/ErrMsg/ErrMsg.js` → `ErrMsg.tsx`
- Rename: `web/client/components/Footer/Footer.js` → `Footer.tsx`
- Rename: `web/client/components/GuideBtns/GuideBtns.js` → `GuideBtns.tsx`
- Rename: `web/client/components/Intro/Intro.js` → `Intro.tsx`
- Rename: `web/client/components/JsonSchemaEditor/JsonSchemaEditor.js` → `JsonSchemaEditor.tsx`
- Rename: `web/client/components/Label/Label.js` → `Label.tsx`
- Rename: `web/client/components/Loading/Loading.js` → `Loading.tsx`
- Rename: `web/client/components/LogoSVG/index.js` → `index.tsx`
- Rename: `web/client/components/MyPopConfirm/MyPopConfirm.js` → `MyPopConfirm.tsx`
- Rename: `web/client/components/ProjectCard/ProjectCard.js` → `ProjectCard.tsx`
- Rename: `web/client/components/SchemaTable/SchemaTable.js` → `SchemaTable.tsx`
- Rename: `web/client/components/Subnav/Subnav.js` → `Subnav.tsx`
- Rename: `web/client/components/TimeLine/TimeLine.js` → `TimeLine.tsx`
- Rename: `web/client/components/UsernameAutoComplete/UsernameAutoComplete.js` → `UsernameAutoComplete.tsx`
- Create: `web/tests/fixtures/phase3-shared-ui.html`
- Create: `web/tests/fixtures/phase3-shared-ui.tsx`
- Create: `web/tests/browser/phase3-shared-ui.spec.ts`
- Modify: exact first-party imports of the renamed modules.

**Interfaces:**
- Consumes: Wave 1 shims, Phase 2 `RootState`, reducer state exports, React
  Router v5 types, and existing style modules.
- Produces: typed props/state for the 20 shared components with unchanged
  default exports, ref behavior, callbacks, conditional rendering, and DOM.
- Produces: browser fixture signals `window.__phase3ConfirmResult` and a stable
  `data-testid="toggle-loading"` control.

- [ ] **Step 1: Add the baseline shared UI browser fixture**

The fixture renders `Loading` and `MyPopConfirm` with extensionless imports:

```tsx
function SharedUiCanary() {
  const [visible, setVisible] = useState(false);
  const [confirmKey, setConfirmKey] = useState(0);
  return (
    <>
      <button data-testid="toggle-loading" onClick={() => setVisible(value => !value)}>
        toggle loading
      </button>
      <button data-testid="reopen-confirm" onClick={() => setConfirmKey(value => value + 1)}>
        reopen confirm
      </button>
      <Loading visible={visible} />
      <MyPopConfirm
        key={confirmKey}
        msg="leave editor"
        callback={result => { window.__phase3ConfirmResult = result; }}
      />
    </>
  );
}
```

The Playwright test installs `installConsoleGuard`, asserts `.loading-box` is
initially hidden and becomes `display: flex`, clicks `确定`, asserts
`window.__phase3ConfirmResult === true`, reopens the confirmation, clicks
`取消`, and asserts `false`.

- [ ] **Step 2: Run the fixture against JavaScript**

Run: `npm --prefix web run test:browser -- tests/browser/phase3-shared-ui.spec.ts`

Expected: PASS against the current JavaScript components with no console or
page errors.

- [ ] **Step 3: Verify the Wave 2 boundary is RED**

Run: `PHASE3_COMPLETED_WAVE=2 npm --prefix web run test:phase3:policy`

Expected: FAIL on the 20 Wave 2 source/target pairs.

- [ ] **Step 4: Rename and type leaf components**

Use local `Props` and `State` types. Preserve lifecycle names, default props,
React keys, ref assignment, conditional branches, and mutation. Use these
patterns:

```ts
interface LoadingProps { visible?: boolean }
interface LoadingState { show: boolean }

interface ConfirmationProps {
  msg?: string;
  callback: (confirmed: boolean) => void;
}

type RouterParams = Readonly<Record<string, string | undefined>>;
```

Type Redux-backed components from `RootState`; do not duplicate reducer state
shapes. Type dynamic schema/editor values as `unknown` plus local guards. Keep
imperative editor and drag-sort instances in explicitly nullable fields.

After each rename, use `legacyCompletedSourceSpecifiers` from the policy test to
rewrite every production-closure consumer to an extensionless import. This
includes already typed consumers such as
`client/containers/Login/LoginContainer.tsx` and later-wave JavaScript such as
`client/containers/Follows/Follows.js`. Do not rewrite Appendix A or `exts/`
source; the reviewed Vite aliases remain their compatibility mechanism.

- [ ] **Step 5: Verify shared UI behavior and strict typing**

```bash
PHASE3_COMPLETED_WAVE=2 npm --prefix web run test:phase3:policy
npm --prefix web run test:browser -- tests/browser/phase3-shared-ui.spec.ts tests/browser/decorator-canary.spec.ts tests/browser/sanitize-canary.spec.ts
npm --prefix web run typecheck
npm --prefix web run build
git diff --check
```

Expected: policy and all selected Chrome/CDP tests pass, TypeScript reports zero
diagnostics, build passes, and the policy reports no unsafe escapes or legacy
completed-source imports.

- [ ] **Step 6: Commit Wave 2**

```bash
git status --short
git add web/client web/tests/fixtures/phase3-shared-ui.html web/tests/fixtures/phase3-shared-ui.tsx web/tests/browser/phase3-shared-ui.spec.ts
git diff --cached --check
git commit -m "refactor(web): type shared UI components"
```

---

### Task 4: Wave 3 — migrate light domains and Project prerequisites

**Files:**
- Rename: `web/client/components/AuthenticatedComponent.js` → `AuthenticatedComponent.tsx`
- Rename: `web/client/components/Header/Header.js` → `Header.tsx`
- Rename: `web/client/components/Header/Search/Search.js` → `Search.tsx`
- Rename: `web/client/components/ModalPostman/MethodsList.js` → `MethodsList.tsx`
- Rename: `web/client/components/ModalPostman/MockList.js` → `MockList.tsx`
- Rename: `web/client/components/ModalPostman/VariablesSelect.js` → `VariablesSelect.tsx`
- Rename: `web/client/components/ModalPostman/index.js` → `index.tsx`
- Rename: `web/client/containers/AddProject/AddProject.js` → `AddProject.tsx`
- Rename: `web/client/containers/Follows/Follows.js` → `Follows.tsx`
- Rename: `web/client/containers/Group/Group.js` → `Group.tsx`
- Rename: `web/client/containers/Group/GroupList/GroupList.js` → `GroupList.tsx`
- Rename: `web/client/containers/Group/GroupLog/GroupLog.js` → `GroupLog.tsx`
- Rename: `web/client/containers/Group/GroupSetting/GroupSetting.js` → `GroupSetting.tsx`
- Rename: `web/client/containers/Group/MemberList/MemberList.js` → `MemberList.tsx`
- Rename: `web/client/containers/Group/ProjectList/ProjectList.js` → `ProjectList.tsx`
- Rename: `web/client/containers/Home/Home.js` → `Home.tsx`
- Rename: `web/client/containers/Project/Setting/ProjectEnv/ProjectEnvContent.js` → `ProjectEnvContent.tsx`
- Rename: `web/client/containers/Project/Setting/ProjectEnv/index.js` → `index.tsx`
- Rename: `web/client/containers/Templates/Templates.js` → `Templates.tsx`
- Rename: `web/client/containers/User/List.js` → `List.tsx`
- Rename: `web/client/containers/User/Profile.js` → `Profile.tsx`
- Rename: `web/client/containers/User/User.js` → `User.tsx`
- Create: `web/tests/typescript-phase-3-light-domains.test.mjs`
- Create: `web/tests/browser/fixtures/auth/search-results.json`
- Modify: `web/tests/browser/auth.spec.ts`
- Modify: `web/tests/browser/support/mockApi.ts`
- Modify: exact first-party imports of the renamed modules.

**Interfaces:**
- Consumes: `RootState`, typed user/group/project/interface reducers, Wave 1
  adapters, and Wave 2 shared UI.
- Produces: typed route params, mapped state, dispatch callbacks, form values,
  group/user/project records, ModalPostman transformation state, and ProjectEnv
  request payloads.
- Preserves: auth redirects, search navigation, Group tabs, member/project
  mutation, confirmation timing, environment sorting, variable tree path
  construction, and returned request promises.

- [ ] **Step 1: Lock domain behavior before renaming**

Add named exports for the existing `deepEqual`, `deleteLastObject`, and
`deleteLastArr` functions without moving or rewriting them. Add Vite SSR tests
for method-list cloning and variable path manipulation. Assert that cloning
does not retain nested array identity and that the path helpers preserve exact
strings such as `$.case.params.field` and `$.case.body[0]`.

Add this deterministic `/api/project/search` fixture:

```json
{
  "errcode": 0,
  "errmsg": "成功",
  "data": {
    "group": [{ "_id": 12, "groupName": "搜索分组" }],
    "project": [{ "_id": 21, "name": "Phase 3 Project", "groupId": 11 }],
    "interface": [{ "_id": 31, "title": "Get user", "projectId": 21 }]
  }
}
```

Register it as `'/api/project/search'` in `sharedFixtures`. Extend the
successful auth browser test to fill `搜索分组/项目/接口`, assert all three labels
`分组: 搜索分组`, `项目: Phase 3 Project`, and `接口: Get user`, select the group
result, and assert navigation to `/group/12`. Keep the existing missing-fixture
abort behavior for every unregistered API.

Run:

```bash
node --test web/tests/typescript-phase-3-light-domains.test.mjs
npm --prefix web run test:browser -- tests/browser/auth.spec.ts
```

Expected: tests pass against JavaScript.

- [ ] **Step 2: Verify the Wave 3 boundary is RED**

Run: `PHASE3_COMPLETED_WAVE=3 npm --prefix web run test:phase3:policy`

Expected: FAIL on the 22 Wave 3 pairs.

- [ ] **Step 3: Type auth, Header, User, and light domains**

Use `RouteComponentProps` with only accessed params. Use intersections of
`OwnProps`, `StateProps`, and `DispatchProps`; map state from `RootState`.
Preserve decorator order and do not replace `@connect` or `@withRouter` with
hooks.

```ts
type GroupRouteParams = { groupId?: string };
type ProjectRouteParams = { id: string };
type Props = OwnProps & StateProps & DispatchProps & RouteComponentProps<GroupRouteParams>;
```

Keep API and imported record fields local. Additional historical fields use an
`unknown` index only at the incoming API boundary, then narrow before render or
serialization.

Rewrite every Wave 3 completed-source reference reported by the policy to an
extensionless production import. Appendix A and `exts/` remain untouched.

- [ ] **Step 4: Type ModalPostman and ProjectEnv prerequisites**

Preserve the `METHODS_LIST` objects, deep-copy behavior, array/object variable
path spelling, tree selection keys, environment ordering, form callbacks, and
async lifecycle order. Model method parameters as `(string | number)[]` only
where the component reads those primitives; keep arbitrary response bodies as
`unknown`.

- [ ] **Step 5: Verify Wave 3 GREEN**

```bash
PHASE3_COMPLETED_WAVE=3 npm --prefix web run test:phase3:policy
node --test web/tests/typescript-phase-3-light-domains.test.mjs
npm --prefix web run test:browser -- tests/browser/auth.spec.ts tests/browser/phase3-shared-ui.spec.ts
npm --prefix web run typecheck
npm --prefix web run build
git diff --check
```

Expected: policy, deterministic tests, Chrome/CDP, typecheck, and build pass;
the policy reports no unsafe escapes or legacy completed-source imports.

- [ ] **Step 6: Commit Wave 3**

```bash
git status --short
git add web/client web/tests/typescript-phase-3-light-domains.test.mjs web/tests/browser/fixtures/auth/search-results.json web/tests/browser/auth.spec.ts web/tests/browser/support/mockApi.ts
git diff --cached --check
git commit -m "refactor(web): type light UI domains"
```

---

### Task 5: Wave 4 — migrate Project feature modules

**Files:**
- Rename: `web/client/components/Postman/Postman.js` → `Postman.tsx`
- Rename: `web/client/containers/Project/Activity/Activity.js` → `Activity.tsx`
- Rename: `web/client/containers/Project/Interface/Docs/DocsInterface.js` → `DocsInterface.tsx`
- Rename: `web/client/containers/Project/Interface/InterfaceCol/CaseReport.js` → `CaseReport.tsx`
- Rename: `web/client/containers/Project/Interface/InterfaceCol/ImportInterface.js` → `ImportInterface.tsx`
- Rename: `web/client/containers/Project/Interface/InterfaceCol/InterfaceColContent.js` → `InterfaceColContent.tsx`
- Rename: `web/client/containers/Project/Interface/InterfaceCol/InterfaceColMenu.js` → `InterfaceColMenu.tsx`
- Rename: `web/client/containers/Project/Interface/InterfaceList/AddInterfaceCatForm.js` → `AddInterfaceCatForm.tsx`
- Rename: `web/client/containers/Project/Interface/InterfaceList/AddInterfaceForm.js` → `AddInterfaceForm.tsx`
- Rename: `web/client/containers/Project/Interface/InterfaceList/Edit.js` → `Edit.tsx`
- Rename: `web/client/containers/Project/Interface/InterfaceList/InterfaceContent.js` → `InterfaceContent.tsx`
- Rename: `web/client/containers/Project/Interface/InterfaceList/InterfaceEditForm.js` → `InterfaceEditForm.tsx`
- Rename: `web/client/containers/Project/Interface/InterfaceList/InterfaceList.js` → `InterfaceList.tsx`
- Rename: `web/client/containers/Project/Interface/InterfaceList/InterfaceMenu.js` → `InterfaceMenu.tsx`
- Rename: `web/client/containers/Project/Interface/InterfaceList/View.js` → `View.tsx`
- Rename: `web/client/containers/Project/Setting/ProjectData/ProjectData.js` → `ProjectData.tsx`
- Rename: `web/client/containers/Project/Setting/ProjectMember/ProjectMember.js` → `ProjectMember.tsx`
- Rename: `web/client/containers/Project/Setting/ProjectMessage/ProjectMessage.js` → `ProjectMessage.tsx`
- Rename: `web/client/containers/Project/Setting/ProjectMessage/ProjectTag.js` → `ProjectTag.tsx`
- Rename: `web/client/containers/Project/Setting/ProjectMock/index.js` → `index.tsx`
- Rename: `web/client/containers/Project/Setting/ProjectRequest/ProjectRequest.js` → `ProjectRequest.tsx`
- Rename: `web/client/containers/Project/Setting/ProjectToken/ProjectToken.js` → `ProjectToken.tsx`
- Rename: `web/client/containers/Project/Setting/Setting.js` → `Setting.tsx`
- Rename: `web/client/containers/Project/TemplateProject/TemplateDocument.js` → `TemplateDocument.tsx`
- Rename: `web/client/containers/Project/TemplateProject/TemplateEditor.js` → `TemplateEditor.tsx`
- Rename: `web/client/containers/Project/TemplateProject/TemplateNav.js` → `TemplateNav.tsx`
- Rename: `web/client/containers/Project/TemplateProject/TemplateProject.js` → `TemplateProject.tsx`
- Create: `web/client/containers/Project/Interface/InterfaceList/requestContracts.ts`
- Create: `web/tests/fixtures/phase3-project-core.html`
- Create: `web/tests/fixtures/phase3-project-core.tsx`
- Create: `web/tests/browser/phase3-project-core.spec.ts`
- Create: `web/tests/typescript-phase-3-project.test.mjs`
- Modify: exact first-party imports of the renamed modules.

**Interfaces:**
- Consumes: typed API helpers, `RootState`, all Phase 2 reducers, Wave 1
  adapters, Wave 2 controls, and Wave 3 ProjectEnv/ModalPostman prerequisites.
- Produces: local Project, interface, case, schema, request, response, template,
  member, tag, token, mock, and form contracts driven only by read fields.
- Preserves: request construction, query encoding, body serialization, JSON
  parsing failures, editor mounting, mutation, request timing, conflict flows,
  Postman callbacks, schema conversion, and template save spelling.

- [ ] **Step 1: Write failing Project request-boundary tests**

Write tests against the following narrow request-descriptor contract, but do
not create `requestContracts.ts` yet:

```ts
export interface RequestDescriptor<TBody> {
  url: string;
  body: TBody;
}

export function createInterfaceUpdateRequest<T extends Record<string, unknown>>(
  params: T,
  id: string
): RequestDescriptor<T & { id: string }> {
  const body = params as T & { id: string };
  body.id = id;
  return { url: '/api/interface/up', body };
}

export function createProjectTagUpdateRequest<TTag>(
  id: string | number,
  tag: readonly TTag[]
): RequestDescriptor<{ id: string | number; tag: readonly TTag[] }> {
  return { url: '/api/project/up_tag', body: { id, tag } };
}

export function createSchemaPreviewRequest(
  schema: unknown
): RequestDescriptor<{ schema: unknown }> {
  return { url: '/api/interface/schema2json', body: { schema } };
}
```

`typescript-phase-3-project.test.mjs` loads this pure module through Vite SSR
and asserts all three exact URLs, payload keys, and interface-params identity.
Do not duplicate transport logic or add fallback behavior.

Run:

```bash
node --test web/tests/typescript-phase-3-project.test.mjs
```

Expected: FAIL because `requestContracts.ts` does not exist.

Run the existing baseline contracts separately:

```bash
npm --prefix web test -- --match='common › project data config › *'
```

Expected: existing ProjectData exporter/importer behavior passes against
JavaScript.

- [ ] **Step 2: Add the real editor browser fixture**

Mount `TemplateEditor` with:

```tsx
const template = {
  key: 'phase3-template',
  title: 'Before',
  description: 'Before description',
  markdown: '# Before'
};

function ProjectCoreCanary() {
  const [mounted, setMounted] = useState(true);
  return (
    <>
      <button data-testid="unmount-template" onClick={() => setMounted(false)}>
        unmount
      </button>
      {mounted ? (
        <TemplateEditor
          template={template}
          onCancel={() => { window.__phase3TemplateCancelled = true; }}
          onSave={value => { window.__phase3TemplateSaved = value; }}
        />
      ) : null}
    </>
  );
}
```

The Playwright test fills `标题`, `描述`, `变更原因`, and `变更摘要`, clicks
`保存`, and asserts the saved object contains the unchanged key, updated text,
real editor Markdown, and exact snake-case keys `change_reason` and
`change_summary`. Then click `unmount-template`, assert `.template-editor` is
absent, and assert no page or console errors so the editor `destroy` path runs.

- [ ] **Step 3: Run the Project fixture against JavaScript**

Run: `npm --prefix web run test:browser -- tests/browser/phase3-project-core.spec.ts`

Expected: PASS with the real Toast UI Editor module.

- [ ] **Step 4: Verify the Wave 4 boundary is RED**

Run: `PHASE3_COMPLETED_WAVE=4 npm --prefix web run test:phase3:policy`

Expected: FAIL on the 27 Wave 4 pairs.

- [ ] **Step 5: Type Project settings and template modules**

Start with ProjectData, ProjectMember, ProjectMessage/Tag, ProjectMock,
ProjectRequest, ProjectToken, Setting, and TemplateProject. Keep form decorators,
mutation, async lifecycle methods, and payload spelling. Reuse the typed pure
adapters from Wave 1 and ProjectEnv contracts from Wave 3.

- [ ] **Step 6: Type InterfaceList and editor modules**

Create `requestContracts.ts` with the exact Step 1 contract. `Edit` must
continue filtering empty tag names before calling
`createProjectTagUpdateRequest`. `createInterfaceUpdateRequest` intentionally
mutates the original params object before returning it because the existing
method does. `InterfaceEditForm` must continue parsing JSON before constructing
the schema request. Replace only the three direct `axios.post(url, body)`
argument constructions with their descriptors; preserve await and callback
order.

Then migrate Add/Edit/View/Menu/List/Content and the 1,300-line
`InterfaceEditForm.tsx` without structural redesign. Define local form and
schema records from accessed fields. Narrow parsed JSON and third-party editor
callbacks at their entry points. Preserve `componentWillReceiveProps`, direct
state mutation, schema conversion exceptions, WebSocket URL construction, and
all exact request fields.

- [ ] **Step 7: Type InterfaceCol, Docs, and Postman**

Migrate DocsInterface, CaseReport, ImportInterface, InterfaceColContent,
InterfaceColMenu, and Postman. Keep `InterfaceCaseContent` in Wave 5 because it
imports Postman through the shared component barrel. Do not replace that barrel
import with a deep import because doing so can change module evaluation.

Postman request values, parsed bodies, schema extensions, and plugin inputs
enter as `unknown`. Narrow before property access; do not add validation,
sanitization, retry, or fallback behavior.

Rewrite every Wave 4 completed-source reference reported by the policy to an
extensionless production import. Appendix A and `exts/` remain untouched.

- [ ] **Step 8: Verify Wave 4 GREEN**

```bash
PHASE3_COMPLETED_WAVE=4 npm --prefix web run test:phase3:policy
node --test web/tests/typescript-phase-3-project.test.mjs
npm --prefix web test
npm --prefix web run test:browser -- tests/browser/phase3-project-core.spec.ts tests/browser/phase3-shared-ui.spec.ts
npm --prefix web run typecheck
npm --prefix web run build
git diff --check
```

Expected: all focused tests, AVA, Chrome/CDP, typecheck, and production build
pass; the policy reports no unsafe escapes or legacy completed-source imports.

- [ ] **Step 9: Commit Wave 4**

```bash
git status --short
git add web/client web/tests/fixtures/phase3-project-core.html web/tests/fixtures/phase3-project-core.tsx web/tests/browser/phase3-project-core.spec.ts web/tests/typescript-phase-3-project.test.mjs
git diff --cached --check
git commit -m "refactor(web): type Project feature modules"
```

---

### Task 6: Wave 5 — migrate barrels, routing, and application integration

**Files:**
- Rename: `web/client/components/index.js` → `index.ts`
- Rename: `web/client/containers/Project/Interface/InterfaceCol/InterfaceCaseContent.js` → `InterfaceCaseContent.tsx`
- Rename: `web/client/containers/Project/Interface/Interface.js` → `Interface.tsx`
- Rename: `web/client/containers/Project/Project.js` → `Project.tsx`
- Rename: `web/client/containers/index.js` → `index.ts`
- Rename: `web/client/Application.js` → `Application.tsx`
- Create: `web/client/containers/Project/Interface/interfaceRoute.ts`
- Create: `web/tests/typescript-phase-3-routing.test.mjs`
- Modify: `web/tests/browser/auth.spec.ts`
- Modify: exact first-party imports of the renamed modules.

**Interfaces:**
- Consumes: all typed modules from Waves 1-4, Phase 2 `RootState`, plugin route
  hooks, extension component boundaries, and React Router v5.
- Produces: typed component/container barrels, Project and Interface route
  selection, application route table, auth redirect, breadcrumb sequence, and
  root mounting.
- Preserves: barrel evaluation, plugin route mutation, private-group member
  filtering, route order, redirects, loading behavior, and lifecycle dispatch
  order.

- [ ] **Step 1: Add a pure route-selection boundary and RED tests**

Do not SSR-load the complete `Interface` module because its Ace/brace
dependencies require browser globals. Write tests against the following pure
module contract, but do not create the module yet:

```ts
export type InterfaceRouteResult =
  | { kind: 'list' }
  | { kind: 'content' }
  | { kind: 'collection' }
  | { kind: 'case' }
  | { kind: 'unresolved' }
  | { kind: 'redirect'; path: string };

export function selectInterfaceRoute(
  projectId: string,
  action: string,
  actionId?: string
): InterfaceRouteResult {
  if (action === 'api') {
    if (!actionId) return { kind: 'list' };
    if (!Number.isNaN(Number(actionId))) return { kind: 'content' };
    if (actionId.indexOf('cat_') === 0) return { kind: 'list' };
    return { kind: 'unresolved' };
  }
  if (action === 'col') return { kind: 'collection' };
  if (action === 'case') return { kind: 'case' };
  return { kind: 'redirect', path: `/project/${projectId}/interface/api` };
}
```

Load only `interfaceRoute.ts` through Vite SSR and assert:

- `action='api'` without `actionId` returns `list`;
- numeric `actionId` returns `content`;
- `cat_` IDs return `list`;
- an unmatched API ID returns `unresolved`, retaining the existing missing
  component failure path;
- `action='col'` returns `collection`;
- `action='case'` returns `case`;
- an unknown action returns redirect path `/project/21/interface/api`.

Run: `node --test web/tests/typescript-phase-3-routing.test.mjs`

Expected: FAIL because `interfaceRoute.ts` does not exist.

- [ ] **Step 2: Verify the Wave 5 boundary is RED**

Run: `PHASE3_COMPLETED_WAVE=5 npm --prefix web run test:phase3:policy`

Expected: FAIL on the six Wave 5 pairs.

- [ ] **Step 3: Migrate the shared component barrel and Interface routing**

Rename `components/index.js` only after every export is typed. Then migrate
`InterfaceCaseContent` and `Interface` in the same wave, retaining the barrel
import and route component identity. Replace only the inline route-selection
condition tree with a new `interfaceRoute.ts` containing the exact Step 1
contract. Map its result to the same component
identities and call `history.replace(result.path)` only for `redirect`. For
`unresolved`, retain an undefined component creation path rather than adding a
fallback. Type route parameters as:

```ts
interface InterfaceRouteParams {
  id: string;
  action: string;
  actionId?: string;
}
```

- [ ] **Step 4: Migrate Project, the container barrel, and Application**

Preserve `Project` lifecycle `await` order, private-group filtering, plugin
`sub_nav` mutation, redirect paths, and template-project branch. Rename
`containers/index.js` only after all exports exist as TypeScript. In
`Application.tsx`, retain route order, `checkLoginState`, plugin route injection,
`getUserConfirmation`, and the existing `renderInto(container, element)` call
order.

Rewrite every final completed-source reference reported by the policy to an
extensionless production import. Appendix A and `exts/` remain untouched.

- [ ] **Step 5: Verify deterministic application behavior**

```bash
PHASE3_COMPLETED_WAVE=5 npm --prefix web run test:phase3:policy
node --test web/tests/typescript-phase-3-routing.test.mjs
npm --prefix web run test:browser -- tests/browser/auth.spec.ts tests/browser/phase3-shared-ui.spec.ts tests/browser/phase3-project-core.spec.ts tests/browser/decorator-canary.spec.ts tests/browser/store-canary.spec.ts
npm --prefix web run typecheck
npm --prefix web run build
git diff --check
```

Expected: policy, routing, local Chrome/CDP, strict typecheck, and production
build pass; the policy reports no unsafe escapes or legacy completed-source
imports.

- [ ] **Step 6: Commit Wave 5**

```bash
git status --short
git add web/client web/tests/typescript-phase-3-routing.test.mjs web/tests/browser/auth.spec.ts
git diff --cached --check
git commit -m "refactor(web): type application routing shell"
```

---

### Task 7: Accept the migration and record evidence

**Files:**
- Modify: `web/scripts/typescript/runtime-js-allowlist.json`
- Modify: `web/tests/typescript-runtime-policy.test.mjs`
- Create: `web/docs/superpowers/reports/2026-08-16-typescript-phase-3-ui-results.md`

**Interfaces:**
- Consumes: the complete 88-entry module map and five wave commits.
- Produces: zero `migration-target`, one `generated`, 14 `extension-compat`, an
  unchanged 18-path non-runtime exclusion inventory, and measured final test
  evidence.

- [ ] **Step 1: Remove the 85 migrated runtime allowlist entries**

Keep only `client/plugin-module.js` with classification `generated` and the 14
existing `extension-compat` entries. Do not regenerate or rewrite extension
classifications.

- [ ] **Step 2: Strengthen final runtime policy**

Assert all of the following:

```js
assert.equal(byClassification['migration-target'] || 0, 0);
assert.equal(byClassification.generated, 1);
assert.equal(byClassification['extension-compat'], 14);
assert.deepEqual(validation.violations, []);
assert.deepEqual(validation.staleEntries, []);
assert.equal(phaseThreeMap.entries.length, 88);
assert.deepEqual(phaseThreeValidation.forwardWaveEdges, []);
assert.deepEqual(phaseThreeValidation.unmappedReachableJavaScript, []);
assert.deepEqual(phaseThreeValidation.unexpectedExcludedReachability, []);
assert.deepEqual(phaseThreeValidation.unsafeEscapeMatches, []);
assert.deepEqual(phaseThreeValidation.legacyCompletedSourceSpecifiers, []);
assert.deepEqual(phaseThreeValidation.excludedSourceChanges, []);
```

- [ ] **Step 3: Run the runtime inventory**

Run: `npm --prefix web run inventory:runtime -- --check`

Expected: exit 0 with zero violations and stale entries; the only production
JavaScript classifications are one generated module and 14 extension modules.

- [ ] **Step 4: Run the unsafe-escape and explicit-import checks**

Run:

```bash
PHASE3_COMPLETED_WAVE=5 npm --prefix web run test:phase3:policy
git diff --exit-code fd06247 -- web/exts
```

Expected: the module-map policy enumerates all 88 targets and fails on `any`,
`@ts-ignore`, `@ts-nocheck`, a production consumer still spelling a completed
legacy `.js` source, or a changed Appendix A file. The Git check proves all
`exts/` source remains byte-identical to the accepted baseline.

- [ ] **Step 5: Run the complete deterministic matrix**

```bash
node scripts/verify-docs.mjs scripts/verify-docs.config.json
make test-web
make build-web
make test-web-browser
```

Expected: documentation, all Node tests, AVA, lint, strict typecheck,
production build, runtime inventory, and every local Chrome/CDP test pass. The
console guard reports no unclassified warning, page error, console error, or
failed runtime asset.

- [ ] **Step 6: Run isolated live authentication**

```bash
APIMIND_DEFAULT_PASSWORD=pilot-local-password \
APIMIND_LIVE_SERVER_PORT=18890 \
APIMIND_LIVE_WEB_PORT=4002 \
make test-web-browser-live
```

Expected: one live login test passes through the local Go service. Its uniquely
named Mongo/container resources, network, volume, Chrome process, ports 18890
and 4002, and temporary files are cleaned.

- [ ] **Step 7: Review the complete Phase 3 diff**

Review every wave commit and the combined range. Verify no source change under
`web/exts/`, no Server/storage/ApiMind/desktop packaging diff, no dependency
refresh beyond an approved declaration package, and no behavior-driven
refactor. Re-run any focused test for a corrected finding.

- [ ] **Step 8: Write the results report**

Record:

- exact baseline, wave, and final commit range;
- `85 + 3 = 88` source/target counts and `13/20/22/27/6` wave counts;
- before/after runtime classifications;
- the unchanged 18-path Appendix A inventory;
- TypeScript diagnostic and unsafe-escape counts;
- dependency changes or explicit absence of changes;
- Node, AVA, browser, build, inventory, and live-auth test counts;
- warnings and review findings;
- confirmation that `exts/`, Server, storage, ApiMind, and PC packaging are
  unchanged;
- Phase 4 recommendation for the 18 dormant first-party JS modules and later
  built-in replacement of extension code.

- [ ] **Step 9: Verify documentation and commit final evidence**

```bash
node scripts/verify-docs.mjs scripts/verify-docs.config.json
git diff --check
git add web/scripts/typescript/runtime-js-allowlist.json web/tests/typescript-runtime-policy.test.mjs web/docs/superpowers/reports/2026-08-16-typescript-phase-3-ui-results.md
git commit -m "docs(web): record TypeScript UI migration"
git status --short
```

Expected: documentation verification and diff checks pass, the final evidence
commit contains only reviewed acceptance artifacts, and the worktree is clean.
