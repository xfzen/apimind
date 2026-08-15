# ApiMind Web TypeScript Migration Design

Date: 2026-08-16

## Objective

Incrementally migrate the browser runtime of ApiMind Web from JavaScript to
strict TypeScript. Improve API-contract visibility, Redux state safety,
component refactorability, and editor support without changing browser
behavior, Server contracts, request paths, response shapes, plugin behavior,
or deployment boundaries.

The migration is complete when every repository-owned module reachable from
the production browser entry is TypeScript, except for an explicit and tested
compatibility allowlist. Build configuration, Node-only scripts, generated
files, tests, vendored code, and historical plugin server files are not part of
the production-runtime completion metric.

## Confirmed Decisions

- Use an incremental mixed JavaScript/TypeScript migration. Do not perform a
  repository-wide rename or a single large conversion change.
- Limit the primary target to repository-owned browser-runtime modules under
  `client/`, `common/`, and enabled browser plugin modules under `exts/`.
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
- approximately 135 repository-owned modules and 25,065 lines in the current
  production Vite source maps;
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

The production build currently includes 14 modules from `exts/`, while the
directory contains substantially more historical, disabled, migrated, or
Node-side plugin code. Source presence is therefore not evidence that a file
belongs in the TypeScript migration target.

## Selected Approach

Use a boundary-first vertical migration.

1. Add the TypeScript compiler, strict configuration, and a required
   `typecheck` command while allowing existing JavaScript to continue building.
2. Inventory the actual production import graph and classify remaining
   JavaScript as runtime target, compatibility adapter, generated output,
   tooling, test, vendor, or historical code.
3. Define shared API envelopes, domain entities, runtime globals, Redux state,
   plugin hooks, and backend URL types.
4. Convert low-coupling utilities and state modules.
5. Convert UI in complete business slices, keeping each slice buildable and
   browser-verifiable.
6. Convert the enabled plugin clients and remove temporary compatibility
   declarations.
7. Enforce a zero-unclassified-runtime-JavaScript gate.

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
- use module and JSX settings compatible with the current Vite build;
- include browser-runtime source and repository-owned declaration files;
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
- enabled runtime plugin client modules;
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
classification, the reason JavaScript is still required, and the phase that
removes or permanently accepts it. The gate must reject newly introduced
production JavaScript that is not in the allowlist.

## Shared Contract Model

### API envelope

Define one generic YApi-compatible response envelope for ordinary Go Server
responses:

```ts
export interface ApiResponse<T> {
  errcode: number;
  errmsg?: string;
  data: T;
}
```

Do not force endpoints with different documented shapes into this envelope.
Model exceptions explicitly.

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
- Mock and Advanced Mock data;
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
5. enabled runtime plugin pages.

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

## Plugin and CommonJS Boundary

Define a typed plugin protocol containing:

- hook names;
- hook multiplicity and listener/component kind;
- arguments and return types for each enabled hook;
- plugin options;
- asynchronous loading and failure behavior;
- reducer and route extension contracts.

Advanced Mock and Wiki are the enabled runtime plugin targets. Migrated and
disabled plugins are not re-enabled by this work.

Keep generated plugin output compatible with Vite static analysis. Converting
the Node-only generator or CommonJS registry is optional and does not block
browser-runtime completion. If converted, use a Node-supported module format
and retain the current generated output contract.

Third-party packages without adequate declarations must be isolated behind
small repository-owned adapters or narrow ambient declarations. Do not spread
untyped imports through business components.

## Type-Debt Policy

- `any` is prohibited in domain models, API envelopes, Redux state, public
  component props, and plugin hook contracts.
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
  migration allowlist with a removal phase.

## Migration Slices

### Phase 0: Foundation and protection

- add TypeScript configuration and the typecheck gate;
- add runtime-source classification and the JavaScript allowlist;
- add browser smoke coverage for login, workspace/group navigation, project
  navigation, interface read/edit, and document rendering;
- establish module declarations for required legacy dependencies;
- record the type-error baseline without weakening strict mode.

### Phase 1: Boundaries and low-coupling modules

- API envelope and shared domain types;
- backend URL and request helpers;
- security, Markdown, schema, and import/export pure utilities that are in the
  production graph;
- runtime globals and build-time constants.

### Phase 2: Redux domains

- user/authentication;
- workspace/group and project;
- interface and interface collection;
- documents and templates;
- news, follow, menu, Mock, and remaining modules.

Each domain includes state, actions, selectors, API payloads, and at least one
consumer before moving to the next domain.

### Phase 3: Product UI slices

- login and user;
- workspace/group and project navigation;
- documents and templates;
- interface list and interface editor;
- test collections, Postman tooling, and schema editors.

Large pages must be migrated as behavior-preserving vertical slices. File
splitting is allowed only where it exposes an independently testable boundary;
it must not become a general UI redesign.

### Phase 4: Enabled plugins and compatibility closure

- type the plugin hook system;
- migrate Advanced Mock and Wiki browser modules;
- remove obsolete ambient declarations and temporary `any` adapters;
- shrink the JavaScript allowlist to permanent non-runtime exceptions;
- enforce the final production-runtime TypeScript gate.

## Verification Strategy

Every migration change must run the smallest focused test plus the full Web
verification appropriate to its boundary.

Required repository gates are:

- `npm run typecheck`;
- Node structural, security, build, container, and migration tests;
- AVA functional tests;
- Vite production build;
- dependency, editor, and schema smoke tests affected by the slice;
- browser smoke for affected product flows;
- container smoke when build output or public assets change.

Type-only conversion does not justify skipping browser verification for route,
Redux, form, editor, or plugin code. Vite build success proves transpilation,
not behavioral equivalence.

For each phase, compare production output for:

- successful entry and dynamic plugin chunk loading;
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
- browser smoke protection for the critical product flows selected in Phase 0;
- current production behavior, build, and container verification remain green.

Per-module acceptance requires:

- the module is `.ts` or `.tsx` and passes strict type checking;
- public inputs and outputs are explicit;
- no prohibited type-debt escape hatch is added;
- focused tests cover the contract exposed by the migration;
- no API, Redux, route, editor, plugin, or rendered behavior changes unless
  separately specified and approved.

Final acceptance requires:

- every repository-owned production browser module is TypeScript or appears in
  the permanent compatibility allowlist;
- the permanent allowlist contains no unclassified business module;
- no `@ts-ignore`, `@ts-nocheck`, or domain-layer `any` remains;
- API envelopes, shared entities, Redux state, selectors, routes, and enabled
  plugin hooks have canonical types;
- full typecheck, tests, production build, browser smoke, and container smoke
  pass;
- browser console and production asset loading show no migration regression;
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

Before implementation planning, validate the foundation assumptions with one
pilot slice: authentication API types, the user reducer, selectors, and the
login consumers. The pilot must measure initial diagnostics, third-party type
gaps, type-debt escapes, test additions, and browser verification effort. Use
that evidence to refine phase size; the estimated total effort remains
approximately 6 to 12 engineer-weeks until the pilot is complete.
