# Web TypeScript Phase 0 Authentication Pilot Results

## 1. Scope and commit range

The acceptance snapshot starts at `107f182` and includes the five
implementation commits from `148f62e` through `3e0c9dc`, plus the live-stack
and evidence changes committed with this report. The pilot covered the runtime
JavaScript inventory, strict TypeScript foundation, typed authentication state,
the four authentication UI modules, legacy-decorator verification, deterministic
Chrome CDP browser coverage, and isolated live-stack verification.

The measured committed implementation before this report changed 58 files with
2,887 insertions and 454 deletions. Phase 0 deliberately did not migrate
`exts/`.

## 2. Production runtime modules before and after

The baseline was generated before the authentication conversion in commit
`148f62e`. The accepted result was regenerated from the production Vite source
map after the complete matrix.

| Runtime category | Before | After | Change |
|---|---:|---:|---:|
| TypeScript (`.ts`/`.tsx`) | 1 | 9 | +8 |
| In-scope allowlisted JavaScript (`client/` and `common/`, including the generated plugin module) | 118 | 113 | -5 |
| `exts/` compatibility JavaScript | 14 | 14 | 0 |

The final inventory contains 138 repository runtime sources: 127 JavaScript,
9 TypeScript, and 2 unchanged JSX sources. The JavaScript policy split is 112
`migration-target`, 1 `generated`, and 14 `extension-compat` entries. Both
`violations` and `staleEntries` are empty.

## 3. TypeScript diagnostics

Zero diagnostics. `npm run typecheck` passes with TypeScript 5.9.3,
`strict: true`, `allowJs: true`, `checkJs: false`, and `noEmit: true`.

## 4. Direct declaration packages and third-party gaps

Direct declaration packages added and pinned:

- `@types/core-decorators@0.20.0`
- `@types/node@22.20.0`
- `@types/prop-types@15.7.15`
- `@types/react@18.3.31`
- `@types/react-dom@18.3.7`
- `@types/react-router@5.1.20`
- `@types/react-router-dom@5.3.3`
- `@types/redux-promise@0.5.32`
- `@types/underscore@1.13.0`

Third-party declaration gaps found:

- `core-decorators` did not expose the used `autobind` decorator in a form
  compatible with the pilot compiler configuration.
- Ant Design 6 no longer types the legacy `Row type="flex"` prop.
- The repository-owned legacy Icon shim had no declaration.
- React Redux and React Router HOCs are used as legacy class decorators, which
  their current declarations do not model.

`@playwright/test@1.62.1` supplies its own declarations and was also pinned as a
direct development dependency.

## 5. Ambient declarations and middleware adapters

- `types/browser-globals.d.ts`: declares the Vite-defined API base and the
  existing browser `Window` compatibility globals.
- `types/core-decorators.d.ts`: declares the used `autobind` method decorator.
- `types/antd-legacy.d.ts`: narrows the reviewed Ant Design Row compatibility
  exception to `type="flex"`.
- `client/shims/antdIcon.d.ts`: describes the existing repository-owned legacy
  Icon component.
- `client/types/legacyDecorators.ts`: localizes the HOC-to-legacy-class-decorator
  cast instead of weakening component types globally.
- `client/reducer/promiseTypes.ts`: models the redux-promise input action,
  resolved action, and dispatch return Promise used by authentication.

No other ambient declarations or middleware adapters were introduced.

## 6. Unsafe TypeScript escape count

The acceptance command
`rg -n '\bany\b|@ts-ignore|@ts-nocheck' client common --glob '*.{ts,tsx}'`
returned zero matches. Counts:

- `any`: 0
- `@ts-ignore`: 0
- `@ts-nocheck`: 0

## 7. Verification results

- Focused runtime inventory tests: pass.
- Focused typed user-state tests: 5 pass.
- Legacy decorator and JSX runtime-import transform tests: 3 pass.
- Full Node Web suite: 41 pass.
- Full AVA Web suite: 38 pass.
- TypeScript diagnostics: 0.
- Production Vite build: pass; 6,836 modules transformed in the final matrix.
- Deterministic Chrome CDP browser suite: 4 pass (guest, login success, login
  failure, decorator canary), one worker, empty warning allowlist.
- Isolated live Go/Mongo authentication: 1 pass on explicit ports 18890/4002
  because the documented defaults were already occupied. The uniquely named
  Compose project and volume and ports 18890/4002/19222 were removed after the
  run.
- Runtime inventory: 127 JavaScript modules, no violation or stale allowance.
- Dependency smoke: pass.
- Editor module smoke: pass.
- Schema editor contract smoke: pass.
- Nginx container smoke: pass.
- Public documentation verification and `git diff --check`: pass.

The build still reports the pre-existing vendored Mock.js `eval` warning and
large-chunk advisory. These are build diagnostics, not TypeScript errors or
browser console violations.

## 8. Observed effort

Implementation commits ran from 07:46 to 08:26 Asia/Shanghai. Live-stack
debugging, the complete acceptance matrix, and evidence collection completed by
approximately 08:38, for about 52 minutes of measured execution after the plan
was accepted. Most verification effort went to making Vite dependency
pre-bundling deterministic, exercising local Chrome through CDP, and proving
isolated Compose cleanup.

## 9. Phase 1 recommendation

Keep Phase 1 to batches of roughly 15-25 reachable runtime modules per pull
request. Recommended order:

1. shared reducer middleware and transport utilities, using the Phase 0 API and
   Promise contracts;
2. leaf components with no decorators or route ownership;
3. group and project state modules, followed by their container boundaries;
4. remaining cross-cutting application shell modules only after focused browser
   coverage exists for their routes.

Regenerate the runtime inventory after every batch. Keep `exts/` classified as
compatibility JavaScript until the separately approved built-in replacements
land; do not mix extension replacement into the TypeScript conversion.

## 10. Unchanged boundaries

- `exts/`: unchanged.
- Server source, contracts, and behavior: unchanged; the pinned Server was only
  built and exercised through its public HTTP API.
- Storage schema and data access: unchanged; the live test created state only
  through the isolated Go service and removed its unique Mongo volume.
- ApiMind documentation/resources: unchanged and not synchronized.
- PC application packaging: not run.
