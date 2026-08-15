# ApiMind Web TypeScript Migration Design

Date: 2026-08-16

## Objective

Incrementally migrate the ApiMind Web application code under `client/` and
`common/` from JavaScript to strict TypeScript. Improve API-contract
visibility, Redux state safety, component refactorability, and editor support
without changing browser behavior, Server contracts, request paths, response
shapes, extension behavior, or deployment boundaries.

The migration is complete when every in-scope module under `client/` and
`common/` that is reachable from the production browser entry is TypeScript,
except for an explicit and tested compatibility allowlist. Existing `exts/`
modules are a deliberate scope exception: they remain JavaScript compatibility
dependencies until a separately approved effort replaces them with built-in
Web modules. Build configuration, Node-only scripts, generated files, tests,
vendored code, and historical plugin server files are also outside the
completion metric.

## Confirmed Decisions

- Use an incremental mixed JavaScript/TypeScript migration. Do not perform a
  repository-wide rename or a single large conversion change.
- Limit the target to repository-owned browser-runtime modules under `client/`
  and `common/`, plus narrow TypeScript adapters owned by the main application
  when an in-scope module must call an existing `exts/` module.
- Do not migrate `exts/` internals in this effort. Dynamic runtime extensions
  and statically embedded compatibility modules remain allowlisted JavaScript
  until they are replaced by separately designed built-in implementations.
- Establish strict type checking before converting business modules.
- Migrate contracts and state boundaries before large React pages.
- Preserve class components during type conversion when that is the smallest
  behavior-preserving change. Converting classes to Hooks is a separate
  refactor.
- Preserve current React 18, Redux 4, React Router 5, Axios, Vite, Nginx, and Go
  Server boundaries. Their replacement or major redesign is out of scope.
- Do not change ApiMind or YApi HTTP paths, response envelopes, Cookie/CORS
  behavior, Mock URLs, WebSocket URLs, or plugin enablement as part of type
  migration.
- Do not automatically update ApiMind API documentation.
- Do not build or package a desktop application.
- Resolve new dependencies only through the official npm registry.

## Current Evidence

The current source snapshot contains:

- 205 JavaScript/TypeScript production-like modules and approximately 30,251
  lines under `client/`, `common/`, and `exts/`;
- 135 repository-owned modules in the current production Vite source maps:
  112 under `client/`, 9 under `common/`, and 14 under `exts/`; the 121 modules
  under `client/` and `common/` form the initial in-scope runtime inventory;
- 219 `.js` files across Web and one `.tsx` production module;
- approximately 98 class-component files, 59 decorator-using files, 98
  PropTypes-using files, 59 Redux `connect` users, and 56 modules containing
  CommonJS constructs;
- 13 Redux module files and broad direct access to nested Axios and
  redux-promise payloads such as `action.payload.data.data`;
- no direct `typescript` dependency, no `tsconfig.json`, and no repository
  `typecheck` command;
- Vite support for `.ts` and `.tsx`, demonstrated by the existing
  `client/components/Docs/MarkdownPreview.tsx`, but no independent TypeScript
  correctness gate;
- structural, security, build, and utility tests, but no current browser
  component-test framework protecting the main login, workspace, project, and
  interface-editing flows.

The production build currently includes 14 modules from `exts/`, including
both dynamically loaded extensions and modules statically embedded by the main
application. These modules are known production dependencies but are excluded
from this migration by design. The directory also contains substantially more
historical, disabled, migrated, or Node-side plugin code, so source presence is
not evidence that a file belongs in the runtime compatibility allowlist.

## Selected Approach

Use a boundary-first vertical migration.

1. Add the TypeScript compiler, strict configuration, and a required
   `typecheck` command while allowing existing JavaScript to continue building.
2. Inventory the actual production import graph and classify remaining
   JavaScript as runtime target, compatibility adapter, generated output,
   tooling, test, vendor, or historical code.
3. Define shared API envelopes, domain entities, runtime globals, Redux state,
   main-application extension hooks, and backend URL types.
4. Convert low-coupling utilities and state modules.
5. Convert UI in complete business slices, keeping each slice buildable and
   browser-verifiable.
6. Type the main application's extension-facing adapters while leaving `exts/`
   internals unchanged.
7. Enforce a zero-unclassified-JavaScript gate within `client/` and `common/`.

This approach is preferred over leaf-component-first conversion because the
largest maintenance risks are not JSX syntax. They are inconsistent API
payload shapes, implicit Redux state, route parameters, dynamic plugin hooks,
and compatibility aliases. Establishing those contracts first prevents every
component from inventing local types.

## TypeScript Foundation

Add TypeScript as a direct development dependency and add the direct type
packages required by the selected React and Router versions. Transitive type
packages are not an acceptable project contract.

The initial `tsconfig.json` must:

- set `noEmit: true` and leave Vite responsible for production transpilation;
- set `strict: true` for TypeScript source;
- set `allowJs: true` so migrated TypeScript may import unmigrated JavaScript;
- initially set `checkJs: false`; JavaScript conversion is controlled by the
  migration inventory rather than a flood of inferred legacy diagnostics;
- set `experimentalDecorators: true`, `useDefineForClassFields: false`, and
  `emitDecoratorMetadata: false` to match the current legacy-decorator and
  loose class-field behavior;
- use module and JSX settings compatible with the current Vite build;
- include `client/`, `common/`, and repository-owned declaration files as
  explicit roots; do not add `exts/` as a root, while allowing imported
  allowlisted JavaScript extensions to resolve under `allowJs` and remain
  unchecked under `checkJs: false`;
- exclude `dist/`, vendored code, historical plugin server modules, and other
  classified non-runtime inputs;
- use `skipLibCheck` only as a temporary third-party declaration boundary, not
  as permission to weaken repository-owned types.

Add `npm run typecheck` and make it a mandatory part of `make test-web` and CI.
TypeScript diagnostics must fail verification independently of Vite build
success. Vite transpilation alone is not type verification.

No migrated file may require lowering `strict`, enabling implicit `any`, or
disabling checks for the whole project.

## Runtime Inventory and Deletion Gate

Before converting a directory, classify its files by actual runtime use.

The inventory must distinguish:

- production browser entry and statically imported modules;
- dynamically loaded extension modules and statically embedded `exts/`
  compatibility modules;
- browser compatibility adapters and shims;
- Node-only build and generation scripts;
- generated modules;
- tests and fixtures;
- vendored packages;
- disabled, migrated, or historical plugin code.

Files outside the current runtime must not be converted merely to increase a
migration percentage. Remove them when repository evidence proves they are no
longer required; otherwise retain and classify them. Deletion or archival of a
compatibility layer requires focused build and browser evidence.

Maintain a machine-readable allowlist for repository-owned JavaScript that is
intentionally retained during migration. Each entry must contain the path, its
classification, the reason JavaScript is still required, and its exit
condition. Existing production `exts/` entries use replacement by a built-in
module as their exit condition; that replacement is not a phase of this
migration. The gate must reject newly introduced in-scope production
JavaScript that is not in the allowlist and must reject new dependencies from
`client/` or `common/` into previously unused `exts/` modules.

## Shared Contract Model

### API envelope

Define one generic YApi-compatible response envelope for ordinary Go Server
responses:

```ts
export interface ApiResponse<T> {
  errcode: number;
  errmsg: string;
  data: T | null;
}
```

This models the Go Server contract: `errmsg` is always present, and error
responses use `data: null`. Consumers may treat `data` as non-null only after
an endpoint-appropriate success check. Endpoints with additional top-level
fields, such as user status with `ladp` and `canRegister`, extend the envelope
explicitly. Do not force endpoints with different documented shapes into this
envelope; model exceptions explicitly.

Axios response types must preserve the distinction between
`AxiosResponse<ApiResponse<T>>` and `ApiResponse<T>`. Redux middleware types
must preserve the additional promise-payload layer until the middleware
contract is intentionally changed in a separate design.

### Domain types

Create canonical types for frequently shared entities before converting their
consumers. Initial domains are:

- authenticated user and membership;
- workspace/group and project;
- interface category, interface, request, response, and schema fields;
- test collection and cases;
- document and workspace-project mapping;
- template project and template document;
- main-application Mock data and the Advanced Mock adapter contract;
- route parameters and permissions.

Types must represent server-observed nullability and legacy numeric/string ID
behavior. A cleaner desired model must not replace the actual compatibility
contract.

### OpenAPI relationship

The Server OpenAPI document is a candidate source for generated transport
types, not an assumed complete source of Web types. Before adopting generation,
compare every production Web endpoint against OpenAPI and the compatibility
route inventory, including bundled plugin routes and dynamically constructed
paths.

Current evidence shows approximately 137 OpenAPI paths and 119 literal Web API
paths, but count similarity does not prove path or schema coverage. Generated
types may become authoritative only after this mapping is verified. Until
then, maintain reviewed handwritten boundary types and label uncovered
contract assumptions as requiring verification.

### Runtime validation

TypeScript does not validate network, imported document, Swagger, Postman,
HAR, Mock, local storage, or plugin data at runtime. Retain existing AJV,
sanitization, and input-validation boundaries. Add runtime parsing only where
non-trusted data currently relies on unsafe structural assumptions. Do not add
a second general-purpose schema framework without a demonstrated need.

## Redux Migration

Define `RootState`, domain state interfaces, action payloads, and typed
selectors before migrating connected pages.

For each reducer module:

1. type its initial state from observed runtime fields;
2. define action types and synchronous payloads;
3. define Axios promise payloads as they are delivered by redux-promise;
4. replace repeated deep response access with typed boundary helpers only when
   behavior remains identical;
5. export selectors so components do not reproduce state-tree knowledge;
6. migrate connected consumers after the reducer and selectors are green.

Do not replace Redux, redux-promise, or `connect` during this migration.
Explicit `connect(...)` and existing class components may remain. Redux Hooks
adoption is a later architectural choice.

## React Component Migration

Migrate components in dependency order:

1. leaf presentation components;
2. forms and shared editor adapters;
3. route-aware and Redux-connected components;
4. large project and interface pages;
5. main-application pages and adapters that host extension surfaces.

For a class component, define Props and State and preserve lifecycle methods.
Do not combine conversion with a Hooks rewrite unless the existing component
cannot be typed without first isolating a behavior that already needs focused
tests.

PropTypes may remain temporarily on externally consumed compatibility
components, but TypeScript types become the repository authoring contract.
Remove redundant PropTypes after all repository consumers are typed and any
runtime validation purpose has been evaluated.

Existing legacy decorators may be compiled only with the current semantics
during migration. Do not introduce new decorators. Removing decorators or
changing class-field semantics requires a separate focused refactor and
browser verification.

Phase 0 must convert a small decorated canary containing the patterns used by
the application, including `@connect`, `@withRouter`, and `@autobind`. Its
typecheck, production build, and browser behavior must pass before any bulk
conversion of decorated components. The Vite/Babel transform order for `.ts`
and `.tsx` must be covered by a structural regression test.

## Extension and CommonJS Compatibility Boundary

Define the main application's typed extension-facing protocol containing:

- hook names;
- hook multiplicity and listener/component kind;
- arguments and return types for each enabled hook;
- plugin options;
- asynchronous loading and failure behavior;
- reducer and route extension contracts.

Advanced Mock and Wiki remain dynamically loaded runtime extensions. Import
helpers and Gen Services remain statically embedded compatibility modules.
Their `exts/` implementations are not TypeScript migration targets. In-scope
callers must depend on narrow typed adapters or ambient declarations that
describe only the behavior they consume. Do not move domain types into
`exts/`, deepen extension coupling, re-enable disabled plugins, or treat an
allowlisted extension as evidence that the main application is untyped.

Keep generated plugin output compatible with Vite static analysis. Converting
the Node-only generator or CommonJS registry is optional and does not block
browser-runtime completion. If converted, use a Node-supported module format
and retain the current generated output contract.

Third-party packages without adequate declarations must be isolated behind
small repository-owned adapters or narrow ambient declarations. Do not spread
untyped imports through business components.

## Type-Debt Policy

- `any` is prohibited in domain models, API envelopes, Redux state, public
  component props, and main-application extension hook contracts.
- `unknown` is required at untrusted boundaries and must be narrowed before
  business use.
- `@ts-ignore` is prohibited.
- `@ts-expect-error` requires an adjacent explanation and a focused test or
  third-party compatibility reference.
- Ambient declarations must describe only the APIs actually consumed.
- A migrated module may not be marked `// @ts-nocheck`.
- Type assertions may not be used to conceal nullable or structurally
  incompatible Server responses.
- Temporary compatibility types must remain localized and appear in the
  migration allowlist with an explicit exit condition.

## Migration Slices

### Phase 0: Foundation, pilot, and protection

- add TypeScript configuration and the typecheck gate;
- add runtime-source classification and the JavaScript allowlist;
- add the decorator canary and its transform regression test;
- add deterministic browser smoke coverage for the authentication pilot and
  the authenticated workspace/group landing page;
- establish module declarations for required legacy dependencies;
- migrate the authentication API types, user reducer, selectors, and login
  consumers as the pilot slice;
- record pilot diagnostics and type-debt evidence without weakening strict
  mode.

### Phase 1: Boundaries and low-coupling modules

- API envelope and shared domain types;
- backend URL and request helpers;
- security, Markdown, schema, and in-scope import/export pure utilities that
  are in the production graph;
- runtime globals and build-time constants.

### Phase 2: Redux domains

- remaining user/authentication modules outside the Phase 0 pilot;
- workspace/group and project;
- interface and interface collection;
- documents and templates;
- news, follow, menu, Mock, and remaining modules.

Each domain includes state, actions, selectors, API payloads, and at least one
consumer before moving to the next domain.

### Phase 3: Product UI slices

- remaining login and user UI outside the Phase 0 pilot;
- workspace/group and project navigation;
- documents and templates;
- interface list and interface editor;
- test collections, the main-application side of Postman tooling, and schema
  editors.

Large pages must be migrated as behavior-preserving vertical slices. File
splitting is allowed only where it exposes an independently testable boundary;
it must not become a general UI redesign.

### Phase 4: Compatibility closure

- finish the typed main-application side of extension hooks and adapters;
- remove obsolete ambient declarations and temporary `any` adapters;
- shrink the JavaScript allowlist to classified compatibility exceptions,
  including the deferred production `exts/` modules;
- enforce the final `client/` and `common/` TypeScript gate.

Replacing `exts/` modules with built-in implementations is a separate future
design. It must remove an allowlist entry as each replacement lands, but it is
not required for this migration to complete.

## Browser Verification Protocol

Use Playwright as a direct development dependency installed from the official
npm registry. Phase 0 adds `npm run test:browser` and a separate
`make test-web-browser` target so browser installation and execution remain
explicit rather than making every unit-test invocation download a browser.
CI installs the publisher-provided Chromium build through Playwright and runs
the browser target in the Web job.

Per-change browser tests run Vite on an isolated port and intercept `/api/*`
requests with versioned JSON fixtures derived from Server response tests or
reviewed OpenAPI schemas. Phase 0 covers:

- unauthenticated user status and login rendering;
- successful login and redirect to the workspace/group landing page;
- failed login with no authenticated navigation;
- user-visible authenticated and unauthenticated states; focused reducer tests
  verify the corresponding Redux state transitions.

This mocked transport keeps the fast browser gate deterministic and requires
no database access. Each later product slice adds its own browser fixture and
flow before that slice is accepted: project navigation, interface read/edit,
and document rendering are not Phase 0 prerequisites.

At phase boundaries, run a live-stack smoke against the existing Web dev mode
and Go service on the documented development ports (`4000` and `18889`). Create
test state only through public Go APIs using a unique run prefix; do not access
the database directly. The live smoke verifies proxying, cookies, asset
loading, and the selected phase's critical happy path. It must clean up through
public APIs when supported and otherwise use an isolated Compose project and
volume.

Browser checks fail on uncaught page errors, failed production asset loads,
and application-originated console errors. A warning allowlist must be narrow,
checked into the repository, and contain a reason; browser-extension messages
are not part of the clean Playwright profile and must not be added to the
baseline.

## Verification Strategy

Every migration change must run the smallest focused test plus the full Web
verification appropriate to its boundary.

Required repository gates are:

- `npm run typecheck`;
- Node structural, security, build, container, and migration tests;
- AVA functional tests;
- Vite production build;
- dependency, editor, and schema smoke tests affected by the slice;
- deterministic Playwright smoke for affected product flows;
- live-stack browser smoke at phase boundaries;
- container smoke when build output or public assets change.

Type-only conversion does not justify skipping browser verification for route,
Redux, form, editor, or extension-adapter code. Vite build success proves
transpilation, not behavioral equivalence.

For each phase, compare production output for:

- successful entry and unchanged dynamic extension chunk loading;
- absence of new browser console errors or warnings;
- successful `/api/*`, `/mock/*`, and WebSocket URL construction;
- unchanged plugin registration and failure isolation;
- unchanged Nginx-only packaging.

## Error Handling and Rollback

Type-check errors block merging. Do not suppress them globally to keep the
migration moving.

Runtime regressions must be fixed at the migrated boundary. If a slice cannot
be typed without broad assertions, stop and refine its contract or split it
into smaller units.

Each migration commit must remain independently buildable and revertible. Do
not combine unrelated domains in one commit. Rollback restores the previous
JavaScript module and its imports without requiring a repository-wide revert.

After three failed attempts to type the same boundary without behavior change,
stop and review whether the boundary requires an architectural refactor. Do
not continue stacking compatibility assertions.

## Acceptance Criteria

Foundation acceptance requires:

- direct TypeScript and required direct type dependencies from the official
  npm registry;
- strict `tsconfig.json` with `noEmit`;
- mandatory `typecheck` in local and CI verification;
- a reviewed runtime inventory and machine-readable JavaScript allowlist;
- a passing decorated-component canary;
- deterministic browser smoke for authentication and the authenticated
  workspace/group landing page;
- recorded pilot results covering diagnostics, third-party type gaps, type
  debt, test additions, and browser verification effort;
- current production behavior, build, and container verification remain green.

Per-module acceptance requires:

- the module is `.ts` or `.tsx` and passes strict type checking;
- public inputs and outputs are explicit;
- no prohibited type-debt escape hatch is added;
- focused tests cover the contract exposed by the migration;
- no API, Redux, route, editor, extension-adapter, or rendered behavior changes
  unless separately specified and approved.

Final acceptance requires:

- every in-scope production module under `client/` and `common/` is TypeScript
  or appears in the reviewed compatibility allowlist;
- the reviewed allowlist contains no unclassified business module;
- no in-scope `@ts-ignore`, `@ts-nocheck`, or domain-layer `any` remains;
- API envelopes, shared entities, Redux state, selectors, routes, and
  main-application extension hooks have canonical types;
- full typecheck, tests, production build, browser smoke, and container smoke
  pass;
- browser console and production asset loading show no migration regression;
- existing `exts/` runtime dependencies remain behaviorally unchanged and
  explicitly allowlisted for later built-in replacement;
- Web still calls business APIs only through the Go-side service boundary;
- desktop packaging, Server business behavior, storage, and ApiMind
  documentation remain unchanged.

## Non-Goals

- rewriting all class components as functions;
- replacing Redux, redux-promise, React Router, Axios, Ant Design, Vite, or the
  editor stack;
- redesigning UI or changing product workflows;
- changing HTTP, Mock, WebSocket, authentication, or storage contracts;
- re-enabling disabled historical plugins;
- converting `exts/` modules before their separately designed built-in
  replacements;
- converting all tests, build scripts, configuration, generated output, or
  vendored sources to TypeScript;
- generating API documentation or syncing contracts to ApiMind;
- packaging the PC App;
- claiming compile-time types as runtime validation.

## Delivery Boundaries

Implement the migration as multiple reviewable commits and phase-level review
units. Keep each change limited to one foundation concern or one business
slice. Do not update Server code or ApiMind documentation unless a separately
approved contract defect is discovered.

After this design is approved, write a focused implementation plan for Phase 0
and the authentication pilot. Execute that plan before detailing Phases 1
through 4. The pilot must measure initial diagnostics, third-party type gaps,
type-debt escapes, test additions, and browser verification effort. Use that
evidence to produce the remaining phase plan and effort estimate. Any estimate
for this migration covers only `client/`, `common/`, and main-application
adapters; future extension built-in work is estimated separately.
