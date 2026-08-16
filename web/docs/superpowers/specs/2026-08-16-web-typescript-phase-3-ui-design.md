# Web TypeScript Phase 3 UI Migration Design

## 1. Objective

Migrate all 85 remaining first-party runtime modules classified as
`migration-target`, plus the three first-party JavaScript modules in their
production import closure, to strict TypeScript in one Phase 3 delivery. The
three closure modules are `client/components/index.js`,
`client/containers/index.js`, and `client/shims/tui-editor.js`. Preserve current
runtime behavior while making the complete production-entrypoint closure of
the first-party Web application statically checkable from the typed Redux and
API boundaries established in Phases 0-2.

The accepted baseline is commit `fd06247`. At that baseline the production
runtime inventory contains 100 JavaScript modules: 85 `migration-target`, one
`generated`, and 14 `extension-compat`. A repository import-graph review also
finds the three closure modules above, which the sourcemap-derived inventory
does not report. Phase 3 therefore migrates 88 modules. It succeeds when
`migration-target` reaches zero, no unapproved first-party JavaScript remains
reachable from a production entrypoint, and the generated and extension
classifications remain unchanged.

## 2. Scope

Phase 3 includes every entry classified as `migration-target` in
`web/scripts/typescript/runtime-js-allowlist.json` at commit `fd06247`, plus the
three closure modules named in the objective. A canonical
`scripts/typescript/phase3-module-map.json` records all 88 legacy `.js` paths,
their `.ts` or `.tsx` targets, and their implementation wave. The AVA loader,
wave-boundary policy test, and final acceptance checks consume that map instead
of maintaining independent path lists. This includes:

- application shell and routing;
- seven client compatibility shims, including the production-reachable
  `tui-editor` adapter;
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

The sourcemap runtime inventory is not the sole scope authority because it can
omit tree-shaken barrels and conditionally unreachable modules. A first-party
import-graph check starts from the production entry `client/index.jsx`, follows
static imports, re-exports, `require` calls, and literal dynamic imports, and
verifies the canonical map's dependency closure. Strongly connected modules
form an atomic migration unit and must be assigned to the same wave.

## 3. Non-goals

- Do not modify or migrate source under `web/exts/`.
- Do not migrate the 18 first-party JavaScript modules that are outside the
  accepted production-entrypoint closure at the baseline. They are listed in
  Appendix A and retained as an explicit Phase 4 inventory. If the import-graph
  check proves that a migrated production module depends on one, implementation
  stops and this design's scope and expected counts must be revised before the
  affected wave begins.
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
as five dependency-closed waves. The canonical module map is topologically
validated: a migrated module may depend only on an earlier wave, its own wave,
the typed generated-module declaration, a third-party package, or an approved
extension boundary. If an edge points to a later wave, the provider moves
earlier or the consumer moves later before migration begins. Each wave receives
focused tests, strict type checking, a production build, review, and an isolated
commit. The runtime allowlist is accepted only after all five waves are
complete.

### 4.1 Wave 1: foundation and adapters

Migrate the seven client shims, `client/plugin.js`, pure data/configuration
modules, and low-coupling non-visual helpers. This wave establishes typed
contracts for:

- React root mounting and unmounting;
- legacy Ant Design and Moment compatibility exports;
- plugin registry loading, hook registration, `ready`, and failure handling;
- setting tabs, import/export descriptors, Markdown headings, and other
  adjacent pure values.

The generated `client/plugin-module.js` remains JavaScript and retains the
`generated` classification. A narrow `client/plugin-module.d.ts` declaration
describes its promise and registry shape so generated JavaScript does not leak
`any` into `client/plugin.ts`.

### 4.2 Wave 2: shared UI components

Migrate leaf reusable components used across multiple domains, including
loading, labels, navigation, breadcrumbs, footer, error/empty states,
confirmation, editor, schema, project cards, timeline, docs helpers, and other
shared controls that do not depend on a later container. Project-dependent
Postman controls and the `client/components/index.js` barrel remain in later
waves.

Shared prop or callback types move to `client/types/` only when at least three
runtime modules consume the same stable structure. Single-component types stay
beside the component.

### 4.3 Wave 3: light domains and Project prerequisites

Migrate authentication wrapping, Header/Search, User routing, Follows,
Templates, GroupLog, Home, AddProject, Group pages, and the Project environment
and modal prerequisites required by Postman. These modules consume the typed
`RootState`, user selectors, Redux action contracts, and typed shared UI from
earlier waves. `Application`, `Project`, and the two index barrels remain in the
final integration wave.

Routing, login-state loading, authentication redirects, confirmation dialogs,
plugin route injection, and breadcrumb behavior remain unchanged.

### 4.4 Wave 4: Project features

Migrate Postman and all remaining Project descendants: activity, templates,
tokens, request settings, mock settings, member settings, message settings,
project data import/export, InterfaceList, InterfaceCol implementation modules,
Docs, schema, mock, and large editing modules. Project prerequisites imported
by Postman are already typed in Wave 3. `InterfaceCaseContent` and the
`Interface` route selector remain in Wave 5 because the former intentionally
loads Postman through the shared component barrel.

Domain types include only fields observed by the reducer contract, component,
request body, renderer, or test fixture. Cross-domain values remain separate
unless the same contract is demonstrably shared.

### 4.5 Wave 5: barrels, routing, and application integration

Migrate `client/components/index.js`, `client/containers/index.js`, the Project
route shell, `InterfaceCaseContent`, the `Interface` route selector,
`Application`, and any remaining shell integration modules. The barrels are
migrated only after all exports they expose are typed. This wave reuses the
transport, Redux, routing, shared UI, and domain contracts established earlier
instead of introducing broad local escape types.

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

The AVA TypeScript registration hook consumes the canonical 88-entry module
map. Each legacy `.js` path maps explicitly to its `.ts` or `.tsx` target; the
hook registers compilers for both extensions and transpiles TSX with the
classic React JSX runtime, legacy decorators enabled, and
`useDefineForClassFields: false`. A loader regression test covers `.ts`, `.tsx`,
decorators, and rejection of paths absent from the map. There is no implicit
`.js` to `.ts` fallback.

Vite aliases are added only for explicit legacy `.js` imports that remain in
deferred extension code, including any extension import of the migrated
`tui-editor` shim. Existing Phase 1 and Phase 2 aliases remain narrow and
ordered before broad `client` and `common` aliases.

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
target TypeScript modules or named contracts do not yet exist. A module-map
policy test also fails when a wave imports a first-party JavaScript module from
a later wave or when the production-entrypoint closure contains an unmapped
first-party JavaScript module. Tests then lock the current behavior appropriate
to the wave:

- pure modules: inputs, outputs, mutation, defaults, and exceptions;
- shared UI: conditional rendering, displayed state, event callbacks, and
  empty/error states;
- Redux containers: `RootState` mapping, dispatch arguments, returned promises,
  and lifecycle dispatch order;
- router and shell: loading state, route selection, auth redirect, plugin route
  mutation, and confirmation callbacks;
- Project core: request construction, form serialization, editor/schema/mock
  integration, and current imperative DOM behavior.

Node/AVA covers pure modules, Redux mapping, request construction, and other
behavior that does not require a browser DOM. UI rendering, events, lifecycle
timing, imperative editor mounting, and form interaction use the existing Vite
fixture plus Playwright/Chrome-CDP harness; Phase 3 does not add a second DOM or
React renderer. Vite SSR tests use exact virtual boundaries only for
browser-only dependencies. Production Vite and browser tests continue to
exercise real resolution.

### 9.2 Per-wave verification

Before each wave commit:

- focused Node and/or AVA tests pass;
- the canonical module map and wave dependency-closure policy pass;
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

- all 85 baseline `migration-target` `.js` files and the three additional
  first-party closure `.js` files are removed;
- matching `.ts` or `.tsx` runtime modules exist;
- the canonical module map contains exactly 88 unique source/target mappings,
  and every wave is dependency-closed;
- the runtime inventory contains zero `migration-target`, one `generated`, and
  14 `extension-compat` JavaScript modules;
- inventory `violations` and `staleEntries` are empty;
- the production-entrypoint import graph contains no reachable first-party
  JavaScript except `client/plugin-module.js` and approved `exts/` boundaries;
- the 18 baseline non-runtime first-party JavaScript modules in Appendix A are
  source-identical and remain outside the production-entrypoint closure;
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

## Appendix A: Explicit non-runtime JavaScript inventory

The following baseline first-party JavaScript modules are outside the accepted
production-entrypoint closure and are not Phase 3 migration targets:

- `client/builtins/pluginRegistry.js`;
- `client/components/Docs/DocToc.js`;
- `client/components/Docs/DocTree.js`;
- `client/components/Docs/MarkdownOutline.js`;
- `client/components/Docs/MilkdownEditor.js`;
- `client/components/MockDoc/MockDoc.js`;
- `client/containers/DevTools/DevTools.js`;
- `client/containers/Group/ProjectList/UpDateModal.js`;
- `client/containers/News/News.js`;
- `client/containers/News/NewsList/NewsList.js`;
- `client/containers/News/NewsTimeline/NewsTimeline.js`;
- `common/config.js`;
- `common/createContext.js`;
- `common/formats.js`;
- `common/lib.js`;
- `common/markdown.js`;
- `common/mergeJsonSchema.js`;
- `common/plugin.js`.

This list is an explicit exclusion, not evidence that the files are safe to
delete. If the defined production import-graph check reaches one,
implementation stops and the Phase 3 design and module-map count must be
re-reviewed before work continues. Deletion or product re-enablement requires a
separate review.
