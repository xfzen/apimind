# Web TypeScript Phase 1 Boundaries Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Repository instructions prohibit subagents. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the 13 production-reachable Phase 1 boundary and utility modules from JavaScript to strict TypeScript without changing browser behavior, request paths, response shapes, or extension behavior.

**Architecture:** Preserve every public export and runtime import path while replacing implicit values with reviewed `unknown`, generic, and domain-specific contracts. Work from the outer transport/runtime-constant boundary inward through pure security, Postman, schema, Mock, diff, and import/export utilities; finish by regenerating the source-map-derived runtime JavaScript inventory.

**Tech Stack:** TypeScript 5.9, Vite 5, React 18, Axios, AVA, Node test runner, Playwright with local Chrome over CDP.

## Global Constraints

- Keep `strict: true`, `allowJs: true`, `checkJs: false`, and `noEmit: true`.
- Do not introduce `any`, `@ts-ignore`, or `@ts-nocheck` under `client/` or `common/`.
- Preserve current API paths, Axios configuration, Cookie/CORS behavior, Mock URLs, WebSocket URLs, and exported names.
- Keep `exts/` unchanged; imported extension values remain compatibility inputs.
- Do not convert class components, redesign UI, change Server code, package the desktop app, or synchronize ApiMind documentation.
- Resolve dependencies only through the official npm registry and pin direct declarations exactly if a new declaration package is required.
- Each production rename must be preceded by a focused failing test and followed by focused green verification.

---

### Task 1: Lock the Phase 1 runtime boundary with failing policy tests

**Files:**
- Create: `web/tests/typescript-phase-1-boundaries.test.mjs`
- Modify later: `web/scripts/typescript/runtime-js-allowlist.json`

**Interfaces:**
- Consumes: committed runtime JavaScript allowlist and the 13 approved Phase 1 source paths.
- Produces: `phaseOneModules`, a test-owned list requiring the `.ts` replacement to exist, the `.js` source to be absent, and the allowlist entry to be removed.

- [ ] **Step 1: Write the failing migration-boundary test**

```js
const phaseOneModules = [
  'client/common',
  'client/constants/variable',
  'client/utils/backend',
  'client/utils/request',
  'common/HandleImportData',
  'common/diff-view',
  'common/mock-extra',
  'common/postmanLib',
  'common/power-string',
  'common/sanitize',
  'common/schema-transformTo-table',
  'common/utils',
  'common/validators'
];

test('Phase 1 boundary modules are TypeScript and absent from the JavaScript allowlist', async () => {
  for (const modulePath of phaseOneModules) {
    assert.equal(await exists(`${modulePath}.ts`), true, modulePath);
    assert.equal(await exists(`${modulePath}.js`), false, modulePath);
    assert.equal(allowlistedPaths.has(`${modulePath}.js`), false, modulePath);
  }
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test web/tests/typescript-phase-1-boundaries.test.mjs`

Expected: FAIL because the `.ts` files do not exist and the JavaScript entries remain allowlisted.

- [ ] **Step 3: Commit the red policy test**

```bash
git add web/tests/typescript-phase-1-boundaries.test.mjs
git commit -m "test(web): define TypeScript phase 1 boundary"
```

---

### Task 2: Type backend URLs, the Axios instance, and runtime constants

**Files:**
- Rename: `web/client/utils/backend.js` → `web/client/utils/backend.ts`
- Rename: `web/client/utils/request.js` → `web/client/utils/request.ts`
- Rename: `web/client/constants/variable.js` → `web/client/constants/variable.ts`
- Create: `web/client/types/runtime.ts`
- Create: `web/tests/backend-boundary.test.mjs`
- Modify: `web/vite.config.mjs`

**Interfaces:**
- Produces: `getApiBase(): string`, `getBackendOrigin(): string`, `buildMockUrl(projectId: string | number, basepath?: string, apiPath?: string): string`, `buildWsUrl(apiPath: string): string`, and `buildApiUrl(apiPath: string): string`.
- Produces: the existing default Axios-compatible instance with `withCredentials: true` and the legacy helper assignments preserved.
- Produces: readonly `HttpMethodConfig`, project-color, Mock-source, and layout constants with their current exported names.

- [ ] **Step 1: Add failing Vite-SSR transport tests**

Test build-time API base trimming, backend origin conversion, HTTP/HTTPS WebSocket conversion, Mock/API URL composition, and request instance `baseURL` plus `withCredentials`.

```js
test('backend helpers preserve separated deployment URL behavior', async () => {
  const backend = await server.ssrLoadModule('/client/utils/backend.ts');
  assert.equal(backend.buildMockUrl(7, '/base', '/users'), 'http://localhost:4000/mock/7/base/users');
  assert.equal(backend.buildWsUrl('/api/socket'), 'ws://localhost:4000/api/socket');
  assert.equal(backend.buildApiUrl('/api/user/status'), 'http://localhost:4000/api/user/status');
});
```

- [ ] **Step 2: Run transport tests and verify RED**

Run: `node --test web/tests/backend-boundary.test.mjs`

Expected: FAIL because the `.ts` modules do not exist.

- [ ] **Step 3: Rename the three modules and add explicit contracts**

Use `git mv`. Export `getApiBase` for focused testing without changing its callers. Type the Axios helper augmentation with an intersection based on `AxiosInstance`; do not replace `axios-runtime` or alter the configured instance. Change the Vite `axios` alias from `client/utils/request.js` to `client/utils/request.ts` in the same commit so every bare `axios` import still resolves through the repository wrapper.

```ts
export interface HttpMethodConfig {
  readonly request_body: boolean;
  readonly default_tab: 'query' | 'body';
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'HEAD' | 'OPTIONS' | 'PATCH';
```

- [ ] **Step 4: Run focused tests, typecheck, and existing request-wrapper test**

Run: `node --test web/tests/backend-boundary.test.mjs web/tests/dependency-resolution.test.mjs && npm --prefix web run typecheck`

Expected: PASS with zero TypeScript diagnostics.

- [ ] **Step 5: Commit the transport boundary**

```bash
git add web/client/utils web/client/constants web/client/types/runtime.ts web/tests/backend-boundary.test.mjs web/vite.config.mjs
git commit -m "refactor(web): type runtime transport boundaries"
```

---

### Task 3: Type security, Postman, schema, and value utilities

**Files:**
- Rename: `web/common/sanitize.js` → `web/common/sanitize.ts`
- Rename: `web/common/validators.js` → `web/common/validators.ts`
- Rename: `web/common/postmanLib.js` → `web/common/postmanLib.ts`
- Rename: `web/common/schema-transformTo-table.js` → `web/common/schema-transformTo-table.ts`
- Rename: `web/common/utils.js` → `web/common/utils.ts`
- Create: `web/common/types/schema.ts`
- Create: `web/tests/common-boundaries.test.mjs`
- Modify: existing `.js` imports only where the explicit suffix prevents resolution after rename.

**Interfaces:**
- Produces: `JsonValue`, `JsonObject`, `JsonSchema`, `SchemaTableRow`, `ValidationResult`, `NamedValue`, `PostmanDomain`, and `EmailRule` contracts.
- Preserves: `sanitizeHTML`, `isSafeEmail`, `emailRule`, all four Postman helpers, `schemaTransformToTable`, and every export from `common/utils`.
- Error behavior remains unchanged: invalid schema transformation returns `undefined`; validator failures return `{ valid: false, message }`; JSON parsers return their current false/original fallbacks.

- [ ] **Step 1: Add failing focused behavior tests**

Cover HTML sanitization, email rule resolve/reject, case-insensitive content type detection, methods without request bodies, missing current domains, nested schema rows, JSON path traversal, safe array fallback, and malformed-schema validation.

```js
test('schema and Postman boundaries preserve legacy fallbacks', async () => {
  const postman = await server.ssrLoadModule('/common/postmanLib.ts');
  assert.equal(postman.handleContentType({ 'Content-Type': 'application/json; charset=utf-8' }), 'json');
  assert.equal(postman.checkRequestBodyIsRaw('GET', 'json'), false);
  assert.equal(postman.handleCurrDomain([], 'missing'), undefined);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test web/tests/common-boundaries.test.mjs`

Expected: FAIL because the TypeScript modules are absent.

- [ ] **Step 3: Rename and type security plus Postman modules**

Use `unknown` at external-input boundaries and narrow before property access. Type Ant Design-compatible validation rules locally rather than broadening global declarations.

- [ ] **Step 4: Rename and type schema plus generic value utilities**

Use recursive `JsonValue`/`JsonObject` contracts. Preserve mutation where existing callers rely on it; do not silently clone inputs or normalize values.

- [ ] **Step 5: Run focused tests, existing AVA common/security tests, and typecheck**

Run: `node --test web/tests/common-boundaries.test.mjs && npm --prefix web test -- --match='common › common › *' --match='common › security › *' && npm --prefix web run typecheck`

Expected: PASS with zero TypeScript diagnostics.

- [ ] **Step 6: Commit the typed pure boundaries**

```bash
git add web/common web/client web/tests/common-boundaries.test.mjs
git commit -m "refactor(web): type shared security and schema utilities"
```

---

### Task 4: Type dynamic string, Mock, import/export, diff, and client-common utilities

**Files:**
- Rename: `web/common/power-string.js` → `web/common/power-string.ts`
- Rename: `web/common/mock-extra.js` → `web/common/mock-extra.ts`
- Rename: `web/common/HandleImportData.js` → `web/common/HandleImportData.ts`
- Rename: `web/common/diff-view.js` → `web/common/diff-view.ts`
- Rename: `web/client/common.js` → `web/client/common.ts`
- Create: `web/common/types/import-export.ts`
- Create: `web/tests/dynamic-utility-boundaries.test.mjs`
- Modify: explicit `.js` imports in production consumers only where required by the rename.

**Interfaces:**
- Preserves: the fluent `PowerString` API and `filter` expression grammar; `MockExtra(template, context)` behavior; import/export handler signature and callback ordering; diff-view HTML output; all exports from `client/common`.
- Produces: `StringTransform`, `PowerStringMethod`, `ImportProject`, `ImportPayload`, `ImportProgress`, `DiffFormatter`, and narrow form-rule contracts.
- Dynamic extension data enters as `unknown` and is narrowed locally; no extension source changes are allowed.

- [ ] **Step 1: Add failing tests for dynamic boundaries**

Cover chained string filters, invalid filter fallback, nested Mock context lookup, client path normalization, stable diff HTML, and an import-handler no-data/error path that does not call Axios.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test web/tests/dynamic-utility-boundaries.test.mjs`

Expected: FAIL because the TypeScript modules are absent.

- [ ] **Step 3: Rename and type PowerString and MockExtra**

Use a typed method registry and explicit runtime narrowing. Preserve dynamic prototype installation and the public fluent interface; do not replace it with a new API.

- [ ] **Step 4: Rename and type import/export and diff utilities**

Model only fields observed in the implementation and fixtures. Keep Axios calls routed through the existing alias and preserve endpoint strings exactly.

- [ ] **Step 5: Rename and type client/common**

Use generics for `safeArray`, `deepCopyJson`, `entries`, `safeAssign`, and `arrayChangeIndex`; use `unknown` for parser inputs; retain legacy fallback return types as unions.

- [ ] **Step 6: Run focused and existing compatibility tests plus typecheck**

Run: `node --test web/tests/dynamic-utility-boundaries.test.mjs && npm --prefix web test -- --match='mock-extra*' --match='common › project-data-config › *' --match='lib › *' && npm --prefix web run typecheck`

Expected: PASS with zero TypeScript diagnostics.

- [ ] **Step 7: Commit the dynamic utility boundary**

```bash
git add web/common web/client web/tests/dynamic-utility-boundaries.test.mjs
git commit -m "refactor(web): type dynamic import and utility boundaries"
```

---

### Task 5: Regenerate the runtime inventory and prove the batch

**Files:**
- Modify: `web/scripts/typescript/runtime-js-allowlist.json`
- Modify: `web/tests/typescript-phase-1-boundaries.test.mjs`
- Create: `web/docs/superpowers/reports/2026-08-16-typescript-phase-1-boundaries-results.md`

**Interfaces:**
- Consumes: production Vite source maps from the completed build.
- Produces: an allowlist with all 13 migrated `.js` entries removed, no violations, and no stale entries.

- [ ] **Step 1: Build and regenerate the runtime inventory**

Run: `npm --prefix web run inventory:runtime -- --write-baseline`

Expected: the inventory reports 22 TypeScript runtime modules, 100 in-scope JavaScript modules, 14 unchanged `exts/` JavaScript modules, and no policy violations.

- [ ] **Step 2: Run the Phase 1 policy test and verify GREEN**

Run: `node --test web/tests/typescript-phase-1-boundaries.test.mjs`

Expected: PASS for all 13 renamed modules and removed allowlist entries.

- [ ] **Step 3: Scan for unsafe TypeScript escapes**

Run: `rg -n '\bany\b|@ts-ignore|@ts-nocheck' web/client web/common --glob '*.{ts,tsx}'`

Expected: no matches.

- [ ] **Step 4: Run the complete deterministic matrix**

```bash
node scripts/verify-docs.mjs scripts/verify-docs.config.json
make test-web
make build-web
make test-web-browser
```

Expected: documentation verification, Node tests, AVA tests, strict typecheck, production build, runtime inventory, and all local Chrome/CDP tests pass.

- [ ] **Step 5: Run the isolated live authentication check**

Run with explicit unused ports if 18889/4000 are occupied:

```bash
APIMIND_DEFAULT_PASSWORD=pilot-local-password \
APIMIND_LIVE_SERVER_PORT=18890 \
APIMIND_LIVE_WEB_PORT=4002 \
make test-web-browser-live
```

Expected: 1 live login test passes and the uniquely named Compose project, volume, Chrome process, and ports are cleaned up.

- [ ] **Step 6: Record measured evidence**

The report must include the commit range, before/after runtime counts, diagnostics, direct declaration changes, unsafe-escape count, deterministic and live browser results, build warnings, unchanged boundaries, and Phase 2 recommendation.

- [ ] **Step 7: Verify documentation and commit the phase result**

```bash
node scripts/verify-docs.mjs scripts/verify-docs.config.json
git diff --check
git add web/scripts/typescript/runtime-js-allowlist.json web/tests/typescript-phase-1-boundaries.test.mjs web/docs/superpowers/reports/2026-08-16-typescript-phase-1-boundaries-results.md
git commit -m "docs(web): record TypeScript phase 1 boundaries"
```
