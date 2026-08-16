# Web TypeScript Phase 3 UI migration results

## Outcome

Phase 3 migrated the remaining in-scope WebUI runtime graph from JavaScript to
strict TypeScript without changing `web/exts/`. The accepted module map contains
88 source/target pairs: 85 former runtime allowlist entries plus three closure
modules (`client/shims/tui-editor.js`, `client/components/index.js`, and
`client/containers/index.js`). Wave counts are `13 / 20 / 22 / 27 / 6`.

Baseline: `fd06247`. The accepted implementation range is `fd06247..HEAD` on
`codex/web-typescript-phase3-ui`; the evidence commit is the commit containing
this report.

| Boundary | Commit |
| --- | --- |
| Module map and acceptance boundary | `53a2950` |
| Wave 1: UI foundations and adapters | `90642a6` |
| Wave 2: shared UI components | `df5e003` |
| Wave 3: light domains and prerequisites | `15b1412` |
| Wave 4: Project feature modules | `ebfb9e0` |
| Wave 5: application routing shell | `419bd8e` |

## Runtime JavaScript inventory

| Classification | Before | After |
| --- | ---: | ---: |
| `migration-target` | 85 | 0 |
| `generated` | 1 | 1 |
| `extension-compat` | 14 | 14 |
| Total | 100 | 15 |

`npm --prefix web run inventory:runtime -- --check` completed with zero
violations and zero stale entries. The one generated module is
`client/plugin-module.js`; the remaining 14 JavaScript modules are the deferred
extension compatibility boundary.

The unchanged 18-path non-runtime inventory remains:

- `client/builtins/pluginRegistry.js`
- `client/components/Docs/DocToc.js`
- `client/components/Docs/DocTree.js`
- `client/components/Docs/MarkdownOutline.js`
- `client/components/Docs/MilkdownEditor.js`
- `client/components/MockDoc/MockDoc.js`
- `client/containers/DevTools/DevTools.js`
- `client/containers/Group/ProjectList/UpDateModal.js`
- `client/containers/News/News.js`
- `client/containers/News/NewsList/NewsList.js`
- `client/containers/News/NewsTimeline/NewsTimeline.js`
- `common/config.js`
- `common/createContext.js`
- `common/formats.js`
- `common/lib.js`
- `common/markdown.js`
- `common/mergeJsonSchema.js`
- `common/plugin.js`

## Verification evidence

- Documentation verification: passed.
- Phase 3 policy: 2/2 passed for all five completed waves.
- Strict TypeScript diagnostics: 0.
- Unsafe escapes in the 88 targets: 0 `any`, 0 `@ts-ignore`, and 0
  `@ts-nocheck` matches.
- Legacy explicit `.js` imports of completed targets: 0.
- Runtime inventory: 0 violations and 0 stale entries.
- Node test matrix: 86/86 passed.
- AVA compatibility tests: 42/42 passed.
- Production build: passed, 6,838 modules transformed.
- Local Chrome/CDP browser matrix: 9/9 passed.
- Isolated live Go authentication through ports 18890/4002: 1/1 passed.
- Live-test cleanup: no `apimind-ts-pilot-*` container, network, or volume
  remained after completion.

## Review and scope

The combined diff was reviewed against the module map and the accepted
behavioral contracts. Corrections made during verification were:

- localized the Postman optional legacy callbacks without emitting TypeScript
  `declare` class fields that the current Babel plugin order cannot transform;
- changed completed-source consumers and path-based tests to extensionless or
  `.ts`/`.tsx` paths;
- extended the Redux Vite test stub to intercept `client/plugin`,
  `client/plugin.js`, and `client/plugin.ts`, preventing tests from loading the
  real extension/Sass graph;
- retained exact interface update, project tag, and schema preview request
  descriptors, including the existing interface-update input mutation.

No unresolved migration finding remains. `web/exts/` is byte-identical to
`fd06247`. There are no Server, storage, ApiMind contract, database, or desktop
packaging changes. No dependency or lockfile changed; `web/package.json` only
adds the Phase 3 policy test command.

Warnings retained as non-blocking baseline behavior:

- `baseline-browser-mapping` reports data older than two months;
- Vite reports existing large chunks and the vendored Mock.js `eval` warning;
- Node reports the existing `url.parse()` deprecation during AVA tests;
- local Chrome emits platform/GPU/GCM diagnostic lines outside the guarded page
  console; all browser assertions and console guards pass;
- AVA cannot write its user-level update-check state in the sandbox.

## Follow-up

Phase 4 should assess the 18 dormant first-party JavaScript modules for deletion
before migration. Extension compatibility code should remain deferred until its
approved built-in replacement; it should not be mechanically migrated in place.
