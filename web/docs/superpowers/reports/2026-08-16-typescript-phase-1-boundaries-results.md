# Web TypeScript Phase 1 Boundary Migration Results

## 1. Scope and commit range

The acceptance snapshot starts at `ee79c11`. The implementation is split across
`559ba38`, `e226efc`, `0a4e8f9`, and `893a0ca`; `c89134d` contains the reviewed
execution plan. Commit `28d5018` adds the final concurrent Vite SSR test
isolation and DOMPurify browser canary; the evidence and runtime allowlist are
committed with this report.

Phase 1 migrated these 13 production runtime boundaries without changing their
public behavior:

- `client/common`
- `client/constants/variable`
- `client/utils/backend`
- `client/utils/request`
- `common/HandleImportData`
- `common/diff-view`
- `common/mock-extra`
- `common/postmanLib`
- `common/power-string`
- `common/sanitize`
- `common/schema-transformTo-table`
- `common/utils`
- `common/validators`

## 2. Production runtime inventory

All 13 corresponding `.js` entries were removed from the JavaScript allowlist.
The accepted JavaScript policy split is:

| JavaScript classification | Phase 0 | Phase 1 | Change |
|---|---:|---:|---:|
| `migration-target` | 112 | 99 | -13 |
| `generated` | 1 | 1 | 0 |
| `extension-compat` | 14 | 14 | 0 |
| Total JavaScript | 127 | 114 | -13 |

The production source map currently contains 137 repository runtime modules:
114 `.js`, 1 `.jsx`, 1 `.mjs`, 16 `.ts`, and 5 `.tsx`. Therefore the exact
TypeScript runtime count is 21. Both inventory `violations` and `staleEntries`
are empty.

The Phase 0 report and Phase 1 plan forecast 22 TypeScript modules and 100
remaining migration targets. The regenerated source map proves that forecast
was off by one: the generated plugin module had been included in the in-scope
JavaScript forecast, and the previous extension summary did not separate the
single `.mjs` source. The current counts above come directly from the accepted
build and are the maintained baseline.

## 3. TypeScript contracts and diagnostics

New narrow contracts cover runtime transport configuration, recursive schema
data, import/export callbacks, dynamic diff formatting, and legacy Axios helper
compatibility. Dynamic inputs enter as `unknown` and are narrowed locally.

`tsc` passes with zero diagnostics under `strict: true`, `noEmit: true`,
`allowJs: true`, and `checkJs: false`. A scan of all 13 migrated production
modules found:

- `any`: 0
- `@ts-ignore`: 0
- `@ts-nocheck`: 0

## 4. Typed base-library upgrades

The dependency changes follow the preference for official TypeScript support in
non-UI foundational libraries:

- DOMPurify was upgraded from the legacy 2.x line to exactly `3.4.13`, whose
  official package includes declarations. The temporary repository-owned
  DOMPurify declaration shim was removed.
- `crypto-js` and `md5` do not publish bundled declarations on their selected
  runtime lines, so exact direct declarations were added:
  `@types/crypto-js@4.2.2` and `@types/md5@2.3.6`.
- TypeScript foundation tests pin these declaration decisions so future
  dependency changes cannot silently remove them.

No UI framework migration or broad dependency refresh was included.

## 5. Compatibility and test isolation

Production Vite aliases preserve exact legacy `.js` specifiers still used by
deferred extension code while first-party consumers use the migrated modules.
AVA uses a test-only TypeScript loader with an exact 13-path fallback; it does
not create a general JavaScript-to-TypeScript resolver.

The complete Node suite initially exposed nondeterministic parallel evaluation
of the browser-oriented vendored Mock.js UMD bundle in Vite SSR. The affected
boundary tests now share one test-only virtual Mock runtime. This keeps the
tests isolated from browser globals while production resolution and browser
coverage continue to exercise the real vendored package.

## 6. Verification results

- Public documentation verification: pass.
- Phase 1 policy and dependency pinning tests: pass.
- Full Node Web suite: 54/54 pass.
- Full AVA Web suite: 38/38 pass.
- Lint: pass.
- Strict TypeScript diagnostics: 0.
- Production Vite build: pass; 6,835 modules transformed in the final run.
- Runtime inventory: 114 JavaScript modules, 0 violations, 0 stale entries.
- Deterministic local Chrome/CDP suite: 5/5 pass with one worker, including a
  DOMPurify canary that removes executable markup while retaining safe content.
- Isolated live Go/Mongo/local Chrome CDP authentication: 1/1 pass on ports
  18890/4002/19222.
- Live cleanup: the uniquely named Compose containers, network, volume, Chrome
  process, and all three ports were removed or released.
- `git diff --check`: pass.

The build still reports the pre-existing vendored Mock.js `eval` warning,
Baseline Browser Mapping freshness notice, and large-chunk advisory. Chrome also
emits platform/GPU/GCM diagnostics during isolated CDP runs. None produced a
test failure, browser console contract violation, or TypeScript diagnostic.

## 7. Phase 2 recommendation

Continue with one state-domain batch before migrating UI containers. Reuse the
typed API, promise, runtime transport, schema, and utility contracts created in
Phases 0 and 1. A maintainable next batch is the leaf Redux domains and their
selectors/actions, followed by group/project state only after focused reducer
tests exist. Keep batches near 15-25 reachable runtime modules and regenerate
the production inventory after every batch.

For non-UI libraries encountered in Phase 2, prefer a compatible official
runtime version with bundled TypeScript declarations. When bundled declarations
do not exist, pin an exact maintained declaration package; add a narrow local
declaration only as the last option.

## 8. Unchanged boundaries

- `exts/`: source unchanged; compatibility aliases only preserve its imports.
- Server source, contracts, and behavior: unchanged; the pinned Server was only
  built and exercised through its public HTTP API.
- Storage schema and direct database access: unchanged; live data existed only
  in the isolated service-owned Mongo volume and was removed.
- ApiMind documentation/resources: unchanged and not synchronized.
- PC application packaging: not run.
