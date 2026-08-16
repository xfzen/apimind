# Web TypeScript Phase 2 Redux Layer Design

## 1. Objective

Migrate the complete remaining first-party Redux runtime layer from JavaScript
to strict TypeScript in one Phase 2 delivery. Preserve every current action
string, state field, endpoint, request shape, reducer transition, exception,
and observable mutation behavior. Improve maintainability through explicit
domain contracts and deterministic tests without mixing in behavior fixes.

## 2. Scope

Phase 2 converts these 14 production runtime modules:

1. `client/reducer/create.js`
2. `client/reducer/middleware/messageMiddleware.js`
3. `client/reducer/modules/addInterface.js`
4. `client/reducer/modules/docs.js`
5. `client/reducer/modules/follow.js`
6. `client/reducer/modules/group.js`
7. `client/reducer/modules/interface.js`
8. `client/reducer/modules/interfaceCol.js`
9. `client/reducer/modules/menu.js`
10. `client/reducer/modules/mockCol.js`
11. `client/reducer/modules/news.js`
12. `client/reducer/modules/project.js`
13. `client/reducer/modules/reducer.js`
14. `client/reducer/modules/template.js`

The migration is one integrated delivery, organized into independently tested
and reviewable groups:

- Leaf domains: `menu`, `follow`, `news`, `docs`, `template`, `addInterface`,
  and `mockCol`.
- Interface domains: `interface` and `interfaceCol`.
- Organization domains: `group` and `project`.
- Store infrastructure: `messageMiddleware`, `modules/reducer`, and `create`.

The batch does not modify `exts/`, Server source or contracts, storage, ApiMind
resources, UI components, or PC packaging.

## 3. Non-goals

- Do not fix the existing in-place state mutations in `news`.
- Do not rename misspelled or legacy state fields, action creators, API fields,
  or endpoint parameters.
- Do not normalize direct async action creators into redux-promise actions, or
  convert redux-promise actions into direct async actions.
- Do not redesign the store, replace Redux, add Redux Toolkit, or change
  middleware ordering.
- Do not create a universal business entity model before the repository has a
  stable shared contract for one.
- Do not migrate reducer consumers or UI modules except for exact import
  extension changes required by a renamed module.
- Do not change or remove plugin reducer injection.

## 4. Architecture

### 4.1 Domain modules

Each domain module exports:

- an `initialState` value with a named domain state interface;
- an `actionTypes` object whose values are the unchanged existing action
  strings;
- a named reducer function;
- the reducer as the existing default export;
- the existing action creator names and runtime signatures.

Synchronous actions use a discriminated union with payload fields limited to
what the reducer reads. Resolved HTTP actions use the existing
`ResolvedPromiseAction<T>` contract. Action creators whose payload is an Axios
Promise retain `PromiseAction<T>`. Action creators already declared `async`
retain their `Promise<Action>` behavior.

Unknown or plugin-supplied values enter as `unknown` and are narrowed at the
smallest boundary. No production module may add `any`, `@ts-ignore`, or
`@ts-nocheck`.

### 4.2 API and domain contracts

The existing `ApiResponse<T>`, `PromiseAction<T>`, and
`ResolvedPromiseAction<T>` types remain the common transport contracts.
Phase 2 adds focused domain type files under `client/reducer/types/` only when
multiple modules need the same shape. A type describes only fields observed in
the reducer, action creator, existing consumer, or test fixture.

API contracts preserve nullable and missing data exactly as the current code
observes them. The migration must not introduce a fallback that converts a
current exception into a successful state transition.

### 4.3 Root reducer and plugins

The fixed reducer map retains these keys and meanings:

- `group`
- `user`
- `inter`
- `interfaceCol`
- `project`
- `news`
- `addInterface`
- `menu`
- `follow`
- `mockCol`
- `template`
- `docs`

`emitHook('add_reducer', reducerModules)` continues to run before
`combineReducers`. The fixed map has precise domain reducer types. The mutable
plugin boundary accepts
`Record<string, Reducer<unknown, LegacyReduxAction>>`, where
`LegacyReduxAction` extends Redux `Action<string>` with unknown additional
fields. Dynamic extension reducers therefore do not weaken the fixed
`RootState` contracts.
Phase 2 may add an exact Vite compatibility alias for the renamed root reducer,
but it must not modify extension source.

`RootState` is inferred from the fixed reducer map. Plugin-added keys remain
open runtime state and are not claimed as statically known first-party fields.

### 4.4 Store creation and middleware

`createStore(initialState)` accepts a recursively partial fixed `RootState` and
returns the repository Redux store. Middleware order remains
`redux-promise`, then `messageMiddleware`. HMR continues accepting
`./modules/reducer` and replacing the current reducer without re-creating the
store.

`messageMiddleware` narrows only these legacy fields:

- `action.error`
- `action.payload.message`
- `action.payload.data.errcode`
- `action.payload.data.errmsg`

Its runtime contract remains unchanged:

- a falsy action returns `undefined` without calling `next`;
- `action.error` displays its message or `服务器错误` and then calls `next`;
- a non-zero API `errcode`, except `40011`, displays the API message and throws
  before calling `next`;
- all other actions are passed to `next` and its return value is returned.

## 5. Compatibility strategy

First-party imports should move to extensionless paths or explicit `.ts` only
where required. Deferred callers that still request one of the 14 exact `.js`
paths are supported by narrow Vite and AVA test aliases. There is no generic
rule that maps arbitrary missing JavaScript modules to TypeScript.

`mockCol` is included because it is a first-party Redux module. Its existing
advanced-mock endpoint and reducer behavior remain intact. No advanced-mock
extension file is edited.

The runtime inventory allowlist is regenerated from the final production Vite
source map. Exactly the 14 migrated JavaScript entries must disappear; all
other classifications remain unchanged unless the source map proves a stale
entry.

## 6. Testing strategy

### 6.1 Test-first domain contracts

Each migration group starts with failing Node tests loaded through Vite SSR.
Tests cover the state and behavior that the corresponding module currently
exposes:

- initial state shape;
- synchronous action creators and reducer transitions;
- resolved redux-promise actions;
- direct async action creator return shapes;
- Axios method, URL, query parameters, request body, and serializer behavior;
- the current `news` sorting, append, page increment, and in-place mutation;
- nullable data behavior where it currently exists.

Axios is replaced with a deterministic test-only virtual module. The test
double records calls and returns only the response shapes declared by each
test. Production Axios resolution remains unchanged.

### 6.2 Infrastructure contracts

Focused tests cover:

- middleware pass-through return values;
- generic and payload error messages;
- the `40011` exception;
- root reducer fixed keys and initial state;
- mutation of the reducer registry through `emitHook('add_reducer')`;
- store creation with partial initial state;
- reducer replacement through the HMR boundary.

The plugin hook test uses a test-only virtual plugin module. The production
build and browser suite continue to exercise the real plugin registry.

### 6.3 Browser and acceptance coverage

The deterministic local Chrome/CDP suite retains authentication, group route,
legacy decorator, and sanitizer coverage. It adds a store-startup canary that
imports the migrated store, creates it, and verifies all fixed reducer keys are
initialized without browser console violations.

Final acceptance requires:

- all focused Node reducer tests pass;
- the existing Node and AVA suites pass;
- lint passes;
- strict TypeScript reports zero diagnostics;
- the production Vite build passes;
- the runtime inventory reports zero violations and zero stale entries;
- all local Chrome/CDP tests pass with an empty console-warning allowlist;
- the isolated live Go/Mongo authentication test passes and cleans its unique
  Compose resources, Chrome process, and ports;
- the 14 migrated production modules contain zero `any`, `@ts-ignore`, and
  `@ts-nocheck` matches;
- public documentation verification and `git diff --check` pass;
- `exts/` has no source diff.

## 7. Error handling and behavior preservation

Type narrowing must reflect existing failures instead of swallowing them. If a
reducer currently dereferences missing response data and throws, the typed
reducer continues to do so. If an action creator currently returns an Axios
Promise for middleware resolution, that promise remains the payload. If it
currently awaits Axios before returning an action, it continues to await it.

The phase may improve compile-time messages and test diagnostics. It may not
add runtime validation, logging, fallback data, request retries, or error
recovery.

## 8. Delivery and review boundaries

The work is executed in an isolated `codex/` worktree from the accepted `dev`
commit. The implementation uses incremental commits for the policy boundary,
leaf domains, interface domains, organization domains, store infrastructure,
and final evidence. All commits belong to one Phase 2 branch and one final
integration decision.

A review finding is fixed in Phase 2 only when it affects type safety,
behavioral equivalence, build correctness, deterministic testing, or the
approved migration boundary. Pre-existing business behavior defects are
recorded separately and left unchanged.
