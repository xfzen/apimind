# Web TypeScript Phase 3 UI Migration Design

## 1. Objective

Migrate all 85 remaining first-party runtime modules classified as
`migration-target` from JavaScript to strict TypeScript in one Phase 3
delivery. Preserve current runtime behavior while making the complete
first-party Web application statically checkable from the typed Redux and API
boundaries established in Phases 0-2.

The accepted baseline is commit `fd06247`. At that baseline the production
runtime inventory contains 100 JavaScript modules: 85 `migration-target`, one
`generated`, and 14 `extension-compat`. Phase 3 succeeds when
`migration-target` reaches zero without changing the other two
classifications.

## 2. Scope

Phase 3 includes every entry classified as `migration-target` in
`web/scripts/typescript/runtime-js-allowlist.json` at commit `fd06247`.
This includes:

- application shell and routing;
- six client compatibility shims;
- `client/plugin.js`;
- shared presentational and form components;
- User, Follows, Templates, Home, and AddProject containers;
- all remaining Group containers;
- all remaining Project containers, including Interface, InterfaceCol, Docs,
  Postman, TemplateProject, Project settings, and large editing forms;
- small pure-data and transformation modules located beside those UI modules.

Files containing JSX migrate to `.tsx`. Runtime modules without JSX migrate to
`.ts`. Stylesheets, images, fonts, generated assets, and non-runtime test files
are changed only where an exact import or assertion must follow a renamed
module.

## 3. Non-goals

- Do not modify or migrate source under `web/exts/`.
- Do not replace class components with functions or hooks.
- Do not remove or reorder decorators, lifecycle methods, or higher-order
  components.
- Do not fix deprecated lifecycle usage, state mutation, prop mutation,
  request timing, fallback behavior, or existing rendering defects.
- Do not redesign routes, forms, Redux, plugin hooks, Postman, Mock, Schema, or
  API behavior.
- Do not split large components solely to make the migration easier.
- Do not upgrade React, React Router, Redux, Ant Design, or another UI runtime
  library.
- Do not create a universal project, interface, schema, or form entity model
  before repeated stable fields justify one.
- Do not change Server source or contracts, storage, ApiMind resources, or PC
  application packaging.

## 4. Delivery architecture

Phase 3 is one feature branch and one final integration decision, implemented
as five dependency-ordered waves. Each wave receives focused tests, strict
type checking, a production build, review, and an isolated commit. The runtime
allowlist is accepted only after all five waves are complete.

### 4.1 Wave 1: foundation and adapters

Migrate the six client shims, `client/plugin.js`, pure data/configuration
modules, and low-coupling non-visual helpers. This wave establishes typed
contracts for:

- React root mounting and unmounting;
- legacy Ant Design and Moment compatibility exports;
- plugin registry loading, hook registration, `ready`, and failure handling;
- setting tabs, import/export descriptors, Markdown headings, and other
  adjacent pure values.

The generated `client/plugin-module.js` remains JavaScript and retains the
`generated` classification.

### 4.2 Wave 2: shared UI components

Migrate reusable components used across multiple domains, including loading,
labels, navigation, breadcrumbs, footer, error/empty states, confirmation,
editor, schema, modal Postman, project cards, timeline, docs helpers, and other
shared controls.

Shared prop or callback types move to `client/types/` only when at least three
runtime modules consume the same stable structure. Single-component types stay
beside the component.

### 4.3 Wave 3: shell and light domains

Migrate `Application`, authentication wrapping, Header/Search, User routing,
Follows, Templates, GroupLog, Home, and AddProject. These modules consume the
typed `RootState`, user selectors, Redux action contracts, and typed shared UI
from earlier waves.

Routing, login-state loading, authentication redirects, confirmation dialogs,
plugin route injection, and breadcrumb behavior remain unchanged.

### 4.4 Wave 4: Group and Project perimeter

Migrate Group pages and Project perimeter domains: group list, settings,
members, project list, Project route shell, activity, templates, tokens,
request settings, mock settings, member settings, message settings, project
data import/export, and environment routing.

Domain types include only fields observed by the reducer contract, component,
request body, renderer, or test fixture. Cross-domain values remain separate
unless the same contract is demonstrably shared.

### 4.5 Wave 5: Project core

Migrate the remaining Interface, InterfaceCol, Docs, Postman, environment,
schema, mock, and large editing modules. This wave reuses the transport,
Redux, routing, shared UI, and domain contracts established earlier instead of
introducing broad local escape types.

Large components remain structurally intact unless a tiny extracted type guard
or pure helper is required to express an existing runtime boundary. Extraction
must not change evaluation order, identity, mutation, or error behavior.

## 5. Component typing model

### 5.1 Props and state

Each component defines only the contracts it uses:

- `OwnProps` for caller-supplied values;
- `StateProps` for Redux-derived values;
- `DispatchProps` for mapped actions;
- `RouteProps` or route parameter types for React Router values;
- a named local state type for stateful class components.

The final props type is the relevant intersection. Default props and optional
props preserve current runtime defaults rather than introducing new ones.

### 5.2 Redux

All `mapStateToProps` functions read from the Phase 2 `RootState`. Components
must not redeclare reducer state shapes. Existing action creators and their
promise/direct-async distinctions remain intact.

Class components keep `@connect` and decorator execution order. Where
third-party decorator declarations do not describe the legacy class transform,
the migration uses the existing narrow legacy decorator adapter rather than
changing runtime composition.

### 5.3 Routing

React Router remains on its installed v5 runtime. Route props and dynamic
parameters describe only accessed values such as `match.path`, `match.params`,
`history.push`, and `location`. Route order, exact matching, authentication
wrapping, and plugin-provided route mutation remain unchanged.

### 5.4 Business and dynamic values

Project, group, interface, case, environment, template, schema, mock, log, and
form records use read-field-driven interfaces. A repeated stable type moves to
`client/types/` only after three or more modules require the same fields.

Dynamic JSON, plugin inputs, schema extensions, editor values, and historical
API extension fields enter as `unknown` and are narrowed at the smallest
runtime boundary. Phase 3 production modules may not add `any`, `@ts-ignore`,
or `@ts-nocheck`.

## 6. Behavior preservation and error handling

The TypeScript form must preserve all existing observable behavior, including
behavior that would be undesirable in new code:

- class construction and lifecycle call order;
- decorator and higher-order component order;
- synchronous and asynchronous request timing;
- thrown errors, rejected promises, empty renders, and missing-data failures;
- prop, state, array, and object mutation;
- callback identity and invocation order;
- form serialization, query encoding, and API field spelling;
- DOM lookup, editor mounting, and imperative integration timing;
- plugin hook registration, async readiness, failure logging, and dynamic route
  or reducer mutation.

The migration may add compile-time narrowing and test diagnostics. It may not
add runtime validation, retries, fallback data, sanitization, logging, or error
recovery unless the current module already performs that behavior.

## 7. Module resolution and extension compatibility

First-party runtime imports move to extensionless specifiers. There is no
generic missing-JavaScript-to-TypeScript resolver.

The AVA TypeScript registration hook uses an exact list of the 85 Phase 3
paths. Vite aliases are added only for explicit legacy `.js` imports that
remain in deferred extension code. Existing Phase 1 and Phase 2 aliases remain
narrow and ordered before broad `client` and `common` aliases.

The 14 `extension-compat` files remain JavaScript, source-identical, and outside
strict TypeScript checking. CSS/SCSS, images, fonts, dynamic imports, and public
asset paths retain their current resolution.

## 8. Dependency policy

React, React Router, Redux, Ant Design, and other UI runtimes remain at their
current versions. If a non-UI foundational dependency already has compatible
official bundled TypeScript declarations, those declarations are preferred.
If it has no bundled declarations, an exact maintained declaration package
from the official npm registry may be added. A narrow local declaration is the
last resort and must state the unsupported runtime boundary it represents.

No broad dependency refresh is part of Phase 3.

## 9. Testing strategy

### 9.1 Test-first wave contracts

Each wave starts with a failing policy or behavioral test proving that the
target TypeScript modules or named contracts do not yet exist. Tests then lock
the current behavior appropriate to the wave:

- pure modules: inputs, outputs, mutation, defaults, and exceptions;
- shared UI: conditional rendering, displayed state, event callbacks, and
  empty/error states;
- Redux containers: `RootState` mapping, dispatch arguments, returned promises,
  and lifecycle dispatch order;
- router and shell: loading state, route selection, auth redirect, plugin route
  mutation, and confirmation callbacks;
- Project core: request construction, form serialization, editor/schema/mock
  integration, and current imperative DOM behavior.

Vite SSR tests use exact virtual boundaries for browser-only dependencies.
Production Vite and browser tests continue to exercise real resolution.

### 9.2 Per-wave verification

Before each wave commit:

- focused Node and/or AVA tests pass;
- strict TypeScript reports zero diagnostics;
- the production Vite build passes;
- explicit first-party `.js` imports for migrated modules are absent;
- migrated files contain no unsafe TypeScript escape directives;
- `git diff --check` passes.

### 9.3 Browser and live acceptance

The local Chrome/CDP suite retains login, Redux store, decorator, and sanitizer
coverage. Phase 3 adds browser coverage for the application shell, shared form
controls, and representative Group and core Project flows. The console guard
must report no unclassified warning, page error, console error, or failed
runtime asset.

The isolated Go/Mongo/Web/Chrome authentication test runs after deterministic
coverage and must clean its uniquely named containers, network, volume, Chrome
process, and ports.

## 10. Final acceptance

Phase 3 is complete only when all of the following are true:

- all 85 baseline `migration-target` `.js` files are removed;
- matching `.ts` or `.tsx` runtime modules exist;
- the runtime inventory contains zero `migration-target`, one `generated`, and
  14 `extension-compat` JavaScript modules;
- inventory `violations` and `staleEntries` are empty;
- all migrated production modules contain zero `any`, zero `@ts-ignore`, and
  zero `@ts-nocheck` matches;
- public documentation, full Node, full AVA, lint, strict typecheck, production
  build, runtime inventory, deterministic Chrome/CDP, and isolated live
  authentication all pass;
- `exts/` has no source diff;
- Server, storage, ApiMind resources, and PC packaging remain unchanged;
- test resources and local ports are cleaned;
- a results report records the exact commit range, before/after inventory,
  dependency changes, test counts, warnings, review findings, unchanged
  boundaries, and Phase 4 recommendation;
- the final worktree is clean and `git diff --check` passes.

## 11. Review and delivery

The migration is developed in an isolated `codex/` worktree from the accepted
`dev` baseline. Commits follow the five waves plus final evidence. A review
finding is fixed only when it concerns behavior equivalence, type safety,
build correctness, deterministic testing, or an approved Phase 3 boundary.
Unrelated product and architecture changes remain outside this phase.

Repository instructions prohibit subagents, so design, implementation, review,
and verification remain in the primary session.
