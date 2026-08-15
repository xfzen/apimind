# ApiMind Web TypeScript Phase 0 Authentication Pilot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> `superpowers:executing-plans` to implement this plan task-by-task. Repository
> `AGENTS.md` prohibits subagents. Steps use checkbox (`- [ ]`) syntax for
> tracking.

**Goal:** Establish strict TypeScript, runtime-JavaScript inventory, legacy
decorator verification, deterministic browser testing, and a fully typed
authentication pilot without changing Web behavior or migrating `exts/`.

**Architecture:** Keep Vite as the transpiler and run TypeScript 5.9.3 with
`noEmit` as an independent correctness gate. Model the Go/YApi response
envelope and redux-promise boundary explicitly, migrate the user reducer and
login components as one vertical slice, and protect the slice with reducer,
Vite-transform, mocked-browser, and isolated live-stack verification. Treat
all production `exts/` modules as classified JavaScript compatibility
dependencies pending a separate built-in replacement effort.

**Tech Stack:** Node.js 22+, npm 10+, TypeScript 5.9.3, React 18.3.1,
React Redux 8.1.3, Redux 4.2.1, redux-promise 0.5.3, React Router 5.3.4,
Vite 5.2, AVA 2.4, Node test runner, Playwright 1.62.1, Go service, Docker
Compose.

**Design:**
`web/docs/superpowers/specs/2026-08-16-web-typescript-migration-design.md`

## Global Constraints

- Phase 0 targets `client/`, `common/`, TypeScript declarations, migration
  tooling, and tests. Do not convert files under `exts/`.
- Existing dynamic and statically embedded `exts/` modules must remain
  behaviorally unchanged and explicitly allowlisted.
- Do not introduce new `client/` or `common/` dependencies on previously unused
  `exts/` modules.
- Keep `strict: true`, `allowJs: true`, `checkJs: false`, and `noEmit: true`.
- Keep `experimentalDecorators: true`, `useDefineForClassFields: false`, and
  `emitDecoratorMetadata: false`.
- Pin TypeScript to 5.9.3 for the pilot. A compiler-major upgrade is a separate
  decision after the pilot.
- Preserve React class components, legacy decorators, Redux, redux-promise,
  React Router 5, Axios, HTTP paths, response shapes, cookies, Mock routes,
  WebSocket URLs, and extension enablement.
- `ApiResponse<T>` must use `errmsg: string` and `data: T | null`. Narrow
  `data` only after checking the endpoint's success condition.
- Do not add `any`, `@ts-ignore`, `@ts-nocheck`, or global type-check
  suppression. Use `unknown` and narrow it at untrusted boundaries.
- `@ts-expect-error` requires an adjacent explanation and a focused regression
  test; Phase 0 should not need one.
- Resolve Node packages only through `https://registry.npmjs.org`; allow
  Playwright to obtain Chromium only from its publisher-maintained download
  endpoint.
- Web code must continue calling business APIs only through the Go-side
  service boundary.
- Do not access the database directly. Live verification creates state through
  Go APIs or uses an isolated Compose project and volume.
- Use Web development port `4000` and Go service port `18889`; do not use the
  desktop embedded-server default `18888`.
- Do not package the PC App and do not update ApiMind documentation.
- Do not use subagents. Execute all tasks inline in the primary session.
- Every implementation task follows RED, GREEN, focused verification, then a
  narrow commit.
- Treat every command block as starting from the repository root; directory
  changes in one block do not carry into the next block.

## File Map

| Responsibility | Files |
|---|---|
| Runtime import inventory and JavaScript policy | `scripts/typescript/runtime-inventory.mjs`, `scripts/typescript/runtime-js-allowlist.json`, `tests/typescript-runtime-policy.test.mjs`, `tests/browser-runtime.test.mjs` |
| Compiler and global declarations | `tsconfig.json`, `types/browser-globals.d.ts`, `package.json`, `package-lock.json`, root `Makefile`, `tests/typescript-foundation.test.mjs` |
| Shared transport and middleware contracts | `client/types/api.ts`, `client/reducer/promiseTypes.ts` |
| Authentication domain | `client/types/user.ts`, `client/reducer/modules/user.ts`, `client/reducer/selectors/user.ts`, `tests/user-state.test.mjs` |
| Authentication UI | `client/containers/Login/Login.tsx`, `Reg.tsx`, `LoginWrap.tsx`, `LoginContainer.tsx`, `client/containers/index.js` |
| Decorator compatibility | `tests/fixtures/legacy-decorator-canary.html`, `tests/fixtures/legacy-decorator-canary.tsx`, `tests/legacy-decorator-transform.test.mjs` |
| Deterministic browser gate | `playwright.config.ts`, `tests/browser/auth.spec.ts`, `tests/browser/decorator-canary.spec.ts`, `tests/browser/support/mockApi.ts`, `tests/browser/support/consoleGuard.ts`, `tests/browser/console-warning-allowlist.json`, `tests/browser/fixtures/auth/*.json`, `package.json`, `package-lock.json`, root `Makefile`, `.github/workflows/verify.yml` |
| Live phase-boundary smoke | `playwright.live.config.ts`, `tests/browser/live-auth.spec.ts`, `scripts/smoke/typescript-pilot-live.sh`, root `Makefile` |
| Pilot evidence | `docs/superpowers/reports/2026-08-16-typescript-phase-0-pilot-results.md` |

---

### Task 1: Add the production runtime JavaScript inventory gate

**Files:**

- Create: `web/scripts/typescript/runtime-inventory.mjs`
- Create: `web/scripts/typescript/runtime-js-allowlist.json`
- Create: `web/tests/typescript-runtime-policy.test.mjs`
- Modify: `web/tests/browser-runtime.test.mjs`
- Modify: `web/package.json`

**Interfaces:**

- Consumes: Vite source maps produced from the real production entry.
- Produces:
  `collectRuntimeSources(outDir, webRoot): Promise<string[]>`.
- Produces:
  `validateRuntimeJavaScript(sources, allowlist): { violations: string[]; staleEntries: string[] }`.
- Produces CLI modes `--build --check`, `--build --write-baseline`, and
  `--build --json`.
- Allowlist entry shape:

```ts
interface RuntimeJavaScriptAllowance {
  path: string;
  classification: 'migration-target' | 'generated' | 'extension-compat';
  reason: string;
  exitCondition: string;
}
```

- Classification rules:
  - reachable `.js` under `client/` or `common/` is `migration-target`;
  - generated `client/plugin-module.js` is `generated`;
  - reachable `.js` under `exts/` is `extension-compat`;
  - `node_modules`, `vendor`, `dist`, tests, and source-map virtual modules are
    not repository runtime sources.

- [ ] **Step 1: Write failing unit tests for source-map normalization and policy enforcement**

Create `web/tests/typescript-runtime-policy.test.mjs`. Use temporary source-map
files containing these sources:

```js
[
  '../client/Application.js',
  '../client/components/Docs/MarkdownPreview.tsx',
  '../common/validators.js',
  '../exts/yapi-plugin-wiki/client.js',
  '../node_modules/jsondiffpatch/lib/contexts/context.js'
]
```

Assert that collection returns only the four repository paths. Pass an
allowlist containing `Application.js`, `validators.js`, and Wiki. Assert no
violation. Add `client/new-runtime.js` to the collected source list and assert
that `violations` is exactly `['client/new-runtime.js']`. Remove Wiki from the
allowlist and assert it is also rejected; this prevents new unclassified
extension dependencies.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
cd web
node --test tests/typescript-runtime-policy.test.mjs
```

Expected: FAIL because `scripts/typescript/runtime-inventory.mjs` does not
exist.

- [ ] **Step 3: Implement source-map collection and validation**

Implement `runtime-inventory.mjs` with these rules:

```js
export function validateRuntimeJavaScript(sources, allowlist) {
  const allowed = new Set(allowlist.entries.map(entry => entry.path));
  const runtimeJavaScript = sources.filter(path => path.endsWith('.js'));
  return {
    violations: runtimeJavaScript.filter(path => !allowed.has(path)).sort(),
    staleEntries: allowlist.entries
      .map(entry => entry.path)
      .filter(path => !runtimeJavaScript.includes(path))
      .sort()
  };
}
```

Resolve each source relative to its map file, call `realpath`, and accept it
only when it is inside the current Web root and its first path segment is
`client`, `common`, or `exts`. Never classify by substring matching.

For `--build`, call Vite's JavaScript API with a temporary output directory,
`sourcemap: true`, and `emptyOutDir: true`; remove the temporary directory in a
`finally` block. `--check` exits non-zero for violations or stale entries.
`--json` prints the normalized inventory and validation result without writing
repository files.

- [ ] **Step 4: Generate and inspect the initial baseline**

Add this script to `web/package.json`:

```json
"inventory:runtime": "node scripts/typescript/runtime-inventory.mjs --build"
```

Run:

```bash
cd web
npm run inventory:runtime -- --write-baseline
npm run inventory:runtime -- --check
```

Expected: the JSON file contains every reachable repository `.js` module.
Entries for `exts/` use `extension-compat` and exit condition
`Replace with a separately approved built-in Web module`. Entries for Phase 0
authentication files use exit condition `Phase 0 authentication pilot`.
Remaining `client/` and `common/` entries use exit condition
`Phase 1-3 plan produced after the authentication pilot`.

- [ ] **Step 5: Connect the gate to the existing real Vite build test**

In `web/tests/browser-runtime.test.mjs`, reuse the temporary production build
created in its `before` hook. Add one test that calls
`collectRuntimeSources(outDir, root)`, loads the checked-in allowlist, and
asserts both `violations` and `staleEntries` are empty. Do not add a second
production build to this test file.

- [ ] **Step 6: Verify GREEN and commit**

Run:

```bash
cd web
node --test tests/typescript-runtime-policy.test.mjs tests/browser-runtime.test.mjs
npm run inventory:runtime -- --check
git diff --check
```

Commit:

```bash
git add web/scripts/typescript web/tests/typescript-runtime-policy.test.mjs web/tests/browser-runtime.test.mjs web/package.json
git commit -m "test(web): inventory runtime JavaScript"
```

### Task 2: Establish strict TypeScript and legacy decorator configuration

**Files:**

- Create: `web/tsconfig.json`
- Create: `web/types/browser-globals.d.ts`
- Create: `web/tests/typescript-foundation.test.mjs`
- Modify: `web/package.json`
- Modify: `web/package-lock.json`
- Modify: root `Makefile`

**Interfaces:**

- Produces command `npm run typecheck` as
  `tsc --project tsconfig.json --pretty false`.
- Produces browser globals `__YAPI_API_BASE__`, `Window.API_BASE`,
  `Window.Buffer`, and `Window.global`.
- Makes `make test-web` invoke typecheck. Existing CI already invokes
  `make test-web`, so no separate CI command is needed in this task.

- [ ] **Step 1: Write the failing foundation policy test**

Create `web/tests/typescript-foundation.test.mjs`. Assert:

```js
assert.equal(pkg.devDependencies.typescript, '5.9.3');
assert.equal(pkg.scripts.typecheck, 'tsc --project tsconfig.json --pretty false');
assert.equal(tsconfig.compilerOptions.strict, true);
assert.equal(tsconfig.compilerOptions.noEmit, true);
assert.equal(tsconfig.compilerOptions.allowJs, true);
assert.equal(tsconfig.compilerOptions.checkJs, false);
assert.equal(tsconfig.compilerOptions.experimentalDecorators, true);
assert.equal(tsconfig.compilerOptions.useDefineForClassFields, false);
assert.equal(tsconfig.compilerOptions.emitDecoratorMetadata, false);
assert.match(makefile, /cd web && npm run typecheck/);
```

Also assert that `tsconfig.include` contains only TypeScript roots and
declarations, and that `exts/` is not an explicit root.

- [ ] **Step 2: Run the policy test and verify RED**

Run:

```bash
cd web
node --test tests/typescript-foundation.test.mjs
```

Expected: FAIL because TypeScript, `tsconfig.json`, and `typecheck` are absent.

- [ ] **Step 3: Install exact compiler and declaration dependencies from the official registry**

Run:

```bash
cd web
npm install --save-dev --save-exact typescript@5.9.3 @types/react@18.3.31 @types/react-dom@18.3.7 @types/react-router@5.1.20 @types/react-router-dom@5.3.3 @types/redux-promise@0.5.32 @types/core-decorators@0.20.0 @types/prop-types@15.7.15 @types/underscore@1.13.0 --registry=https://registry.npmjs.org
```

Do not use `--force` or `--legacy-peer-deps`. Confirm every new lockfile
`resolved` URL uses `https://registry.npmjs.org/`.

- [ ] **Step 4: Add the strict compiler configuration**

Create `web/tsconfig.json` with this initial configuration:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": false,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "allowJs": true,
    "checkJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react",
    "baseUrl": ".",
    "paths": {
      "client/*": ["client/*"],
      "common/*": ["common/*"],
      "exts/*": ["exts/*"]
    },
    "experimentalDecorators": true,
    "emitDecoratorMetadata": false
  },
  "include": [
    "client/**/*.ts",
    "client/**/*.tsx",
    "common/**/*.ts",
    "common/**/*.tsx",
    "types/**/*.d.ts"
  ],
  "exclude": ["dist", "node_modules", "vendor", "exts", "test", "scripts"]
}
```

`skipLibCheck` is allowed only for third-party declarations. Do not exclude or
weaken checking for repository `.ts` or `.tsx` files.

- [ ] **Step 5: Declare only the browser globals the repository consumes**

Create `web/types/browser-globals.d.ts`:

```ts
declare const __YAPI_API_BASE__: string;

declare global {
  interface Window {
    API_BASE?: string;
    Buffer?: typeof import('buffer').Buffer;
    global?: Window;
  }
}

export {};
```

- [ ] **Step 6: Wire typecheck into local and CI verification**

Add to `web/package.json`:

```json
"typecheck": "tsc --project tsconfig.json --pretty false"
```

Add this command to root `Makefile` target `test-web` after lint and before
AVA:

```make
	cd web && npm run typecheck
```

- [ ] **Step 7: Verify GREEN and commit**

Run:

```bash
cd web
node --test tests/typescript-foundation.test.mjs
npm run typecheck
npm run lint
cd ..
make test-web
git diff --check
```

Expected: all commands pass. If a repository-owned TypeScript diagnostic
appears, fix its declaration or the actual typed module; do not add a
suppression.

Commit:

```bash
git add Makefile web/package.json web/package-lock.json web/tsconfig.json web/types/browser-globals.d.ts web/tests/typescript-foundation.test.mjs
git commit -m "build(web): establish strict TypeScript"
```

### Task 3: Type the API envelope, redux-promise boundary, and user state

**Files:**

- Create: `web/client/types/api.ts`
- Create: `web/client/types/user.ts`
- Create: `web/client/reducer/promiseTypes.ts`
- Rename: `web/client/reducer/modules/user.js` to
  `web/client/reducer/modules/user.ts`
- Create: `web/client/reducer/selectors/user.ts`
- Create: `web/tests/user-state.test.mjs`
- Modify: `web/client/reducer/modules/reducer.js`
- Modify: `web/client/components/GuideBtns/GuideBtns.js`
- Modify: `web/scripts/typescript/runtime-js-allowlist.json`

**Interfaces:**

- Produces `ApiResponse<T>`, `hasApiData<T>()`, `PromiseAction<TResponse>`,
  `ResolvedPromiseAction<TResponse>`, and `AppDispatch`.
- Produces `UserInfo`, `UserStatusResponse`, `LoginResponse`,
  `RegisterResponse`, `UserOperationResponse`, `LoginCredentials`,
  `RegisterCredentials`, and `UserState`.
- Preserves all existing user action-creator export names.
- Produces selectors `selectUser`, `selectLoginState`, `selectIsAuthenticated`,
  `selectIsLdap`, `selectCanRegister`, and `selectLoginWrapActiveKey`.

- [ ] **Step 1: Write failing reducer and selector tests through Vite SSR**

Create `web/tests/user-state.test.mjs`. Start one Vite middleware server in a
`before` hook and load:

```js
const userModule = await server.ssrLoadModule('/client/reducer/modules/user.ts');
const selectors = await server.ssrLoadModule('/client/reducer/selectors/user.ts');
```

Test these exact cases:

1. unauthenticated status response
   `{ errcode: 40011, errmsg: '未登录', data: null, ladp: false, canRegister: true }`
   produces guest login state, null identity fields, and registration enabled;
2. authenticated status response with user ID `7` produces member login state
   and username `pilot`;
3. successful login produces member state;
4. failed login with `data: null` preserves the previous state;
5. selectors return the same fields without exposing state-tree traversal to
   consumers.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
cd web
node --test tests/user-state.test.mjs
```

Expected: FAIL because the `.ts` reducer and selectors do not exist.

- [ ] **Step 3: Add the transport and middleware types**

Create `web/client/types/api.ts`:

```ts
export interface ApiResponse<T> {
  errcode: number;
  errmsg: string;
  data: T | null;
}

export function hasApiData<T>(response: ApiResponse<T>): response is ApiResponse<T> & { data: T } {
  return response.errcode === 0 && response.data !== null;
}
```

Create `web/client/reducer/promiseTypes.ts`:

```ts
import type { AxiosResponse } from 'axios';
import type { Dispatch } from 'redux';

export interface PromiseAction<TResponse> {
  type: string;
  payload: Promise<AxiosResponse<TResponse>>;
}

export interface ResolvedPromiseAction<TResponse> {
  type: string;
  payload: AxiosResponse<TResponse>;
}

export interface AppDispatch extends Dispatch {
  <TResponse>(action: PromiseAction<TResponse>): Promise<ResolvedPromiseAction<TResponse>>;
}
```

This interface documents the existing redux-promise dispatch return. Do not
change middleware order or runtime action shapes.

- [ ] **Step 4: Add user transport and state contracts**

Create `web/client/types/user.ts` with these required shapes:

```ts
import type { ApiResponse } from './api';

export interface UserInfo {
  _id: number;
  id: number;
  uid: number;
  username: string;
  email: string;
  role: string;
  type: string;
  study: boolean;
  add_time?: number;
  up_time?: number;
}

export interface UserStatusResponse extends ApiResponse<UserInfo> {
  ladp: boolean;
  canRegister: boolean;
}

export type LoginResponse = ApiResponse<UserInfo>;
export type RegisterResponse = ApiResponse<UserInfo>;
export type UserOperationResponse = ApiResponse<null>;

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials extends LoginCredentials {
  userName: string;
  confirm: string;
}

export interface BreadcrumbItem {
  name: string;
  href?: string;
}

export type LoginStateCode = 0 | 1 | 2;

export interface UserState {
  isLogin: boolean;
  canRegister: boolean;
  isLDAP: boolean;
  userName: string | null;
  uid: number | null;
  email: string;
  loginState: LoginStateCode;
  loginWrapActiveKey: string;
  role: string | null;
  type: string | null;
  breadcrumb: BreadcrumbItem[];
  studyTip: number;
  study: boolean;
  imageUrl: string;
}
```

These fields mirror `server/api/internal/types/types.go`, including `ladp`.
Do not rename the legacy field during migration.

- [ ] **Step 5: Rename and type the user reducer without changing exports**

Use `git mv` for `user.js` to `user.ts`. Export named `initialUserState`,
`userReducer`, and `userActionTypes`, while keeping `userReducer` as default.
Type resolved reducer actions separately from promise-returning action
creators. For GET_LOGIN_STATE, derive identity only when `data !== null`.
For LOGIN and REGISTER, update state only when `hasApiData(response)` is true.

Action creators keep these exact signatures:

```ts
export function checkLoginState(): PromiseAction<UserStatusResponse>;
export function loginActions(data: LoginCredentials): PromiseAction<LoginResponse>;
export function loginLdapActions(data: LoginCredentials): PromiseAction<LoginResponse>;
export function regActions(data: RegisterCredentials): PromiseAction<RegisterResponse>;
export function logoutActions(): PromiseAction<UserOperationResponse>;
export function finishStudy(): PromiseAction<UserOperationResponse>;
```

Pass the response type as the Axios generic in every promise action creator.
Keep the existing synchronous action creators and their names. Do not change
URLs or payload keys.

Define the reducer union from resolved API actions keyed by
`GET_LOGIN_STATE`, `LOGIN`, `REGISTER`, `LOGIN_OUT`, and `FINISH_STUDY`, plus
synchronous actions carrying `index: string`, `data: BreadcrumbItem[]`,
`data: string`, or no payload as appropriate. The reducer parameter is this
union; do not use an index signature or `any` to bypass action narrowing.

- [ ] **Step 6: Add typed selectors**

Create `web/client/reducer/selectors/user.ts`:

```ts
import type { UserState } from '../../types/user';

export interface UserRootState {
  user: UserState;
}

export const selectUser = (state: UserRootState): UserState => state.user;
export const selectLoginState = (state: UserRootState) => selectUser(state).loginState;
export const selectIsAuthenticated = (state: UserRootState) => selectUser(state).isLogin;
export const selectIsLdap = (state: UserRootState) => selectUser(state).isLDAP;
export const selectCanRegister = (state: UserRootState) => selectUser(state).canRegister;
export const selectLoginWrapActiveKey = (state: UserRootState) =>
  selectUser(state).loginWrapActiveKey;
```

- [ ] **Step 7: Repair only extension-qualified imports affected by the rename**

Change `./user.js` to `./user` in `client/reducer/modules/reducer.js` and change
`../../reducer/modules/user.js` to `../../reducer/modules/user` in
`client/components/GuideBtns/GuideBtns.js`. Do not modify unrelated imports.

Remove `client/reducer/modules/user.js` from the JavaScript allowlist. The new
`.ts` file must appear in runtime inventory but not in the JavaScript policy.

- [ ] **Step 8: Verify GREEN and commit**

Run:

```bash
cd web
node --test tests/user-state.test.mjs
npm run typecheck
npm run inventory:runtime -- --check
npm test -- --match='*plugin*'
npm run build
git diff --check
```

Commit:

```bash
git add web/client/types web/client/reducer/promiseTypes.ts web/client/reducer/modules/user.ts web/client/reducer/selectors/user.ts web/client/reducer/modules/reducer.js web/client/components/GuideBtns/GuideBtns.js web/tests/user-state.test.mjs web/scripts/typescript/runtime-js-allowlist.json
git commit -m "refactor(web): type authentication state"
```

### Task 4: Migrate login UI and prove legacy decorator transforms

**Files:**

- Rename: `web/client/containers/Login/Login.js` to `Login.tsx`
- Rename: `web/client/containers/Login/Reg.js` to `Reg.tsx`
- Rename: `web/client/containers/Login/LoginWrap.js` to `LoginWrap.tsx`
- Rename: `web/client/containers/Login/LoginContainer.js` to
  `LoginContainer.tsx`
- Create: `web/tests/fixtures/legacy-decorator-canary.html`
- Create: `web/tests/fixtures/legacy-decorator-canary.tsx`
- Create: `web/tests/legacy-decorator-transform.test.mjs`
- Modify: `web/client/containers/index.js`
- Modify: `web/tsconfig.json`
- Modify: `web/scripts/typescript/runtime-js-allowlist.json`

**Interfaces:**

- Login components consume selectors from Task 3 and dispatch through
  `AppDispatch`.
- Login action props return
  `Promise<ResolvedPromiseAction<LoginResponse>>`; the registration action
  prop returns `Promise<ResolvedPromiseAction<RegisterResponse>>`.
- The canary combines `@connect`, `@withRouter`, and `@autobind` under the same
  Vite/Babel/TypeScript settings used by production code.

- [ ] **Step 1: Write the failing transform regression test**

Create `web/tests/legacy-decorator-transform.test.mjs`. Start Vite in
middleware mode and call `transformRequest` for:

```js
[
  '/client/containers/Login/Login.tsx',
  '/client/containers/Login/Reg.tsx',
  '/tests/fixtures/legacy-decorator-canary.tsx'
]
```

Assert each result contains transformed JavaScript and no remaining TypeScript
interface declarations. Also read `vite.config.mjs` and assert the React plugin
still uses `decorators-legacy` and `class-properties` with `loose: true`.

- [ ] **Step 2: Run the transform test and verify RED**

Run:

```bash
cd web
node --test tests/legacy-decorator-transform.test.mjs
```

Expected: FAIL because the `.tsx` components and canary do not exist.

- [ ] **Step 3: Add the decorator canary fixture**

Create an HTML fixture containing `<div id="canary"></div>` and a module
script loading `/tests/fixtures/legacy-decorator-canary.tsx`.

The TSX fixture must:

1. create a Redux store with `{ label: 'connected' }`;
2. wrap the component in `Provider` and `BrowserRouter`;
3. decorate the class with `@connect` and `@withRouter`;
4. decorate `increment()` with `@autobind`;
5. render `connected:0` in an element with `data-testid="decorator-value"`;
6. render a button with `data-testid="decorator-increment"` whose extracted
   callback increments the value to `connected:1`.

Add `tests/fixtures/**/*.tsx` to `tsconfig.include`; keep browser specs outside
the main config until Playwright types are installed in Task 5.

- [ ] **Step 4: Rename and type the four login components**

Use `git mv` so history is preserved. Define explicit props, state, form value,
route, and dispatch-result types. Use `FormInstance<LoginCredentials>` and
`FormInstance<RegisterCredentials>`. Treat the current `onFinish` argument as
`unknown` and narrow `preventDefault` before calling it; do not cast response
data.

Replace object-shorthand mapDispatch only in migrated components with a typed
function:

```ts
const mapDispatch = (dispatch: AppDispatch) => ({
  loginActions: (values: LoginCredentials) => dispatch(loginActions(values)),
  loginLdapActions: (values: LoginCredentials) => dispatch(loginLdapActions(values))
});
```

Use selectors in each `mapStateToProps`. Preserve decorator order, rendered
markup, labels, messages, validation rules, navigation targets, and class
component lifecycle behavior. Keep the current PropTypes declarations during
the pilot; removing runtime PropTypes is a later cleanup after all relevant
consumers are typed.

Change `client/containers/index.js` to import `LoginContainer` without a `.js`
extension. Remove all four old Login `.js` paths from the runtime JavaScript
allowlist.

- [ ] **Step 5: Verify transform and typecheck GREEN**

Run:

```bash
cd web
node --test tests/legacy-decorator-transform.test.mjs tests/user-state.test.mjs
npm run typecheck
npm run inventory:runtime -- --check
npm run build
git diff --check
```

Expected: the canary and login modules transform, strict typecheck is clean,
the JavaScript inventory has no stale entry, and the production build succeeds.

- [ ] **Step 6: Commit**

```bash
git add web/client/containers/Login web/client/containers/index.js web/tests/fixtures web/tests/legacy-decorator-transform.test.mjs web/tsconfig.json web/scripts/typescript/runtime-js-allowlist.json
git commit -m "refactor(web): migrate authentication UI to TypeScript"
```

### Task 5: Add deterministic Playwright authentication coverage

**Files:**

- Create: `web/playwright.config.ts`
- Create: `web/tests/browser/support/mockApi.ts`
- Create: `web/tests/browser/support/consoleGuard.ts`
- Create: `web/tests/browser/console-warning-allowlist.json`
- Create: `web/tests/browser/fixtures/auth/status-guest.json`
- Create: `web/tests/browser/fixtures/auth/status-member.json`
- Create: `web/tests/browser/fixtures/auth/login-success.json`
- Create: `web/tests/browser/fixtures/auth/login-failure.json`
- Create: `web/tests/browser/fixtures/auth/group.json`
- Create: `web/tests/browser/fixtures/auth/group-list.json`
- Create: `web/tests/browser/fixtures/auth/project-list.json`
- Create: `web/tests/browser/auth.spec.ts`
- Create: `web/tests/browser/decorator-canary.spec.ts`
- Modify: `web/package.json`
- Modify: `web/package-lock.json`
- Modify: root `Makefile`
- Modify: `.github/workflows/verify.yml`
- Modify: `web/tsconfig.json`

**Interfaces:**

- Produces `installMockApi(page, scenario)` for scenarios `guest`,
  `login-success`, `login-failure`, and `member`.
- Produces `installConsoleGuard(page)`, which rejects page errors, asset
  failures, console errors, and console warnings not in the reviewed allowlist.
- Produces `npm run test:browser` and root `make test-web-browser`.
- Uses Vite at `127.0.0.1:4100` and aborts unclassified `/api/*` requests.

- [ ] **Step 1: Add failing browser specifications and fixtures**

Create JSON fixtures matching the Go response contracts:

```json
{
  "errcode": 40011,
  "errmsg": "未登录",
  "data": null,
  "ladp": false,
  "canRegister": true
}
```

```json
{
  "errcode": 0,
  "errmsg": "成功！",
  "data": {
    "_id": 7,
    "id": 7,
    "uid": 7,
    "username": "pilot",
    "email": "pilot@example.invalid",
    "role": "admin",
    "type": "site",
    "study": true
  }
}
```

The member-status fixture adds `ladp: false` and `canRegister: true`. The group
fixture uses ID `11`, name `个人空间`, type `private`, role `owner`, and an
empty compatible `custom_field1`. The project-list fixture uses
`{ "list": [], "total": 0, "userinfo": {} }` inside `data`.

`installMockApi` must fulfill these observed routes and abort every other
`/api/*` request with an error that names the missing fixture:

- `/api/user/status`;
- `/api/user/login`;
- `/api/group/get_mygroup`;
- `/api/group/list`;
- `/api/group/get`;
- `/api/project/list`.

Create tests that assert:

1. guest `/login` renders the login form and registration tab;
2. successful login posts the exact email/password fields, navigates to
   `/group` or `/group/11`, and renders `个人空间` plus `项目列表`;
3. failed login remains on `/login` and does not render authenticated
   navigation;
4. the decorator canary increments from `connected:0` to `connected:1` after
   its callback is passed separately and invoked by the button.

Create `console-warning-allowlist.json` with an empty `entries` array. Its
future entry schema is `{ "pattern": "exact regular expression", "reason":
"reviewed compatibility reason" }`; reject entries with an empty reason.
`installConsoleGuard` must fail on `pageerror`, failed production asset
requests, `console.error`, and `console.warn` messages that do not match an
entry. Do not ignore browser-extension output; the Playwright profile has no
extensions.

Add `"test:browser": "playwright test"` to `web/package.json` in this step so
the RED command exercises the intended stable project interface.

- [ ] **Step 2: Run the browser command and verify RED**

Run:

```bash
cd web
npm run test:browser -- tests/browser/auth.spec.ts
```

Expected: FAIL with `playwright: command not found` because the direct
dependency is not installed yet.

- [ ] **Step 3: Install exact Playwright and Node declarations from the official registry**

Run:

```bash
cd web
npm install --save-dev --save-exact @playwright/test@1.62.1 @types/node@22.20.0 --registry=https://registry.npmjs.org
npx playwright install chromium
```

Do not install browser binaries from a mirror. Confirm new npm lockfile URLs
use the official registry.

- [ ] **Step 4: Add deterministic Playwright configuration**

Create `web/playwright.config.ts` with:

```ts
export default defineConfig({
  testDir: './tests/browser',
  testIgnore: ['live-auth.spec.ts'],
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['line'], ['html', { open: 'never' }]] : 'line',
  use: {
    baseURL: 'http://127.0.0.1:4100',
    trace: 'retain-on-failure'
  },
  webServer: {
    command: 'npm run dev:vite',
    url: 'http://127.0.0.1:4100',
    reuseExistingServer: false,
    env: {
      YAPI_WEB_HOST: '127.0.0.1',
      YAPI_WEB_PORT: '4100',
      YAPI_API_TARGET: 'http://127.0.0.1:9',
      VITE_OPEN: 'false'
    }
  }
});
```

Add browser test files and `playwright.config.ts` to `tsconfig.include` now
that Playwright and Node types are direct dependencies.

- [ ] **Step 5: Wire the explicit browser target into package, Make, and CI**

Add root Make target:

```make
.PHONY: test-web-browser
test-web-browser: web-install ## Run deterministic Web browser smoke tests.
	cd web && npm run test:browser
```

In the Web job of `.github/workflows/verify.yml`, after `npm ci`, add:

```yaml
- name: Install publisher-provided Playwright Chromium
  working-directory: web
  run: npx playwright install --with-deps chromium
```

After `make build-web`, add `make test-web-browser`.

- [ ] **Step 6: Verify GREEN and commit**

Run:

```bash
cd web
npm run typecheck
npm run test:browser
npm run build
cd ..
make test-web
make test-web-browser
git diff --check
```

Expected: reducer tests, decorator canary, guest login, successful login, and
failed login all pass with no unclassified request or console error.

Commit:

```bash
git add Makefile .github/workflows/verify.yml web/package.json web/package-lock.json web/playwright.config.ts web/tsconfig.json web/tests/browser
git commit -m "test(web): cover TypeScript authentication pilot"
```

### Task 6: Run isolated live-stack verification and record pilot evidence

**Files:**

- Create: `web/playwright.live.config.ts`
- Create: `web/tests/browser/live-auth.spec.ts`
- Create: `web/scripts/smoke/typescript-pilot-live.sh`
- Create:
  `web/docs/superpowers/reports/2026-08-16-typescript-phase-0-pilot-results.md`
- Modify: root `Makefile`

**Interfaces:**

- Produces `make test-web-browser-live`, which starts an isolated Mongo/Go
  Compose project, starts Vite on `4000` against Go `18889`, runs real login,
  and deletes only the isolated Compose project and volume.
- Requires `APIMIND_DEFAULT_PASSWORD`; accepts
  `APIMIND_DEFAULT_USERNAME`, defaulting to `admin@example.invalid`.
- Does not write to MongoDB directly.

- [ ] **Step 1: Write the failing live authentication test**

Create `live-auth.spec.ts` without route interception. Read credentials only
from environment variables, open `/login`, submit the login form, and assert:

- the login request returns `errcode: 0`;
- the browser reaches `/group` or a `/group/` URL ending in a numeric group ID;
- `个人空间` and `项目列表` render;
- `installConsoleGuard` reports no page error, asset failure, console error, or
  unallowlisted console warning.

Create `playwright.live.config.ts` with base URL from
`APIMIND_LIVE_BASE_URL`, no `webServer`, one Chromium worker, zero retries, and
trace retention on failure.

- [ ] **Step 2: Implement the isolated live-stack runner**

Create `web/scripts/smoke/typescript-pilot-live.sh` with `set -eu`. It must:

1. require `APIMIND_DEFAULT_PASSWORD` and default the username;
2. use Compose project name `apimind-ts-pilot` and `.env.example`;
3. start only `mongo` and `server` from the base and development Compose files;
4. wait for `http://127.0.0.1:18889/api/ping`;
5. start Vite with `YAPI_API_TARGET=http://127.0.0.1:18889`,
   `YAPI_WEB_HOST=127.0.0.1`, and `YAPI_WEB_PORT=4000`;
6. wait for `http://127.0.0.1:4000/`;
7. run only `tests/browser/live-auth.spec.ts` with the live config;
8. use a trap to stop Vite and run Compose `down -v --remove-orphans` for
   project `apimind-ts-pilot` on success, failure, or interruption.

Do not reference an unscoped volume name and do not run `down -v` against the
developer's normal Compose project.

- [ ] **Step 3: Add and run the live Make target**

Add:

```make
.PHONY: test-web-browser-live
test-web-browser-live: web-install ## Run isolated live Go/Web authentication smoke.
	sh web/scripts/smoke/typescript-pilot-live.sh
```

Run with an ephemeral local-only password:

```bash
APIMIND_DEFAULT_PASSWORD=pilot-local-password make test-web-browser-live
```

Expected: real login reaches the workspace/group page, and the isolated stack
and volume no longer exist after the command exits.

- [ ] **Step 4: Run the complete Phase 0 verification matrix**

Run fresh commands in this order:

```bash
node scripts/verify-docs.mjs scripts/verify-docs.config.json
make test-web
make build-web
make test-web-browser
APIMIND_DEFAULT_PASSWORD=pilot-local-password make test-web-browser-live
cd web
npm run inventory:runtime -- --check
npm run smoke:deps
npm run smoke:editor-module
npm run smoke:schema-editor
npm run smoke:container
cd ..
git diff --check
git status --short
```

Do not claim completion if any command fails. Fix the owning task and rerun the
entire matrix.

- [ ] **Step 5: Record the measured pilot result**

Create the pilot report with these sections and populate them from the fresh
command outputs and Git diff:

1. scope and commit range;
2. production runtime modules before and after, split into TypeScript,
   in-scope allowlisted JavaScript, and `exts/` compatibility JavaScript;
3. TypeScript diagnostics, which must be zero at acceptance;
4. direct declaration packages added and third-party declaration gaps found;
5. every ambient declaration and middleware adapter introduced, with reason;
6. counts from
   `rg -n '\bany\b|@ts-ignore|@ts-nocheck' client common --glob '*.{ts,tsx}'`;
7. focused, full Web, production-build, deterministic-browser, live-stack, and
   container verification results;
8. observed implementation and verification effort;
9. recommended size and ordering for the Phase 1 implementation plan;
10. confirmation that `exts/`, Server behavior, storage, ApiMind documentation,
    and PC packaging were unchanged.

State `None` for a category with no findings; do not omit the category.

- [ ] **Step 6: Verify the report and commit the phase-boundary evidence**

Run:

```bash
node scripts/verify-docs.mjs scripts/verify-docs.config.json
git diff --check
git status --short
```

Commit:

```bash
git add Makefile web/playwright.live.config.ts web/tests/browser/live-auth.spec.ts web/scripts/smoke/typescript-pilot-live.sh web/docs/superpowers/reports/2026-08-16-typescript-phase-0-pilot-results.md
git commit -m "docs(web): record TypeScript authentication pilot"
```

After the commit, rerun `git status --short` and verify the worktree is clean.
Use the report's measurements, not the original broad estimate, when writing
the Phase 1 plan.
