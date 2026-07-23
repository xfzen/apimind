# ApiMind Web Security Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove all HIGH and CRITICAL vulnerabilities from the ApiMind Web production dependency graph and runtime image without changing existing UI, API, Mock, import, editor, or container behavior.

**Architecture:** Keep the current React/YApi/Vite application and host-build/runtime-only image boundary. Upgrade the owning direct dependencies, enforce two exact transitive security floors, replace vulnerable Mock.js packaging with a repository-owned copy of official 1.1.0 carrying the NVD-prescribed prototype-pollution guard, and switch to the zero-finding official Nginx unprivileged slim runtime digest.

**Tech Stack:** Node.js 22+, npm 10+, Vite 5, AVA 2, Node test runner, Trivy 0.70.0, official GHCR Trivy DB schema 2, official Nginx unprivileged Alpine slim.

## Global Constraints

- Web filesystem and `apimind-web:local` must both finish at `0 HIGH / 0 CRITICAL`.
- Do not add vulnerability ignores, risk acceptances, scanner exemptions, or misleading production/dev classifications.
- Do not modify PC App, Server behavior, Skills, HTTP/MCP contracts, or storage choices.
- Do not scan Git history.
- Do not use subagents; execute inline in the primary session.
- Resolve npm packages only through `https://registry.npmjs.org`.
- Pull container images and vulnerability databases only from publisher-maintained official registries.
- Build Web assets on the host; Docker may only package prebuilt `dist` assets and Nginx configuration.
- Do not use `--force` or `--legacy-peer-deps` to hide dependency conflicts.

---

### Task 1: Add a production dependency security baseline gate

**Files:**
- Create: `tests/security-baseline.test.mjs`
- Modify: `scripts/verify.sh`

**Interfaces:**
- Consumes: root `package.json` and lockfile v3 `package-lock.json`.
- Produces: a Node test that rejects unsafe direct versions, forbidden production packages, unsafe transitive floors, and non-official npm tarball URLs.

- [x] **Step 1: Write the failing security baseline test**

Create `tests/security-baseline.test.mjs` with a table of required direct
versions:

```js
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));
const lock = JSON.parse(readFileSync(new URL('../package-lock.json', import.meta.url)));

const minimumDirectVersions = {
  axios: '1.18.1',
  'crypto-js': '4.2.0',
  jsrsasign: '11.1.3',
  'sha.js': '2.4.12',
  underscore: '1.13.8',
  json5: '2.2.3',
  'markdown-it': '14.3.0',
  'markdown-it-anchor': '9.2.1',
  'markdown-it-table-of-contents': '1.2.0',
  'json-schema-ref-parser': '9.0.9',
  'json-schema-faker': '0.6.2',
  jsondiffpatch: '0.7.6',
  qs: '6.15.3',
  'swagger-client': '3.37.7'
};

function numericVersion(value) {
  const match = String(value || '').match(/(\d+)\.(\d+)\.(\d+)/);
  assert.ok(match, `expected semantic version, found ${value}`);
  return match.slice(1).map(Number);
}

function atLeast(actual, minimum) {
  const left = numericVersion(actual);
  const right = numericVersion(minimum);
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) return left[index] > right[index];
  }
  return true;
}

test('security-sensitive direct dependencies meet approved floors', () => {
  for (const [name, minimum] of Object.entries(minimumDirectVersions)) {
    assert.ok(atLeast(pkg.dependencies[name], minimum), `${name} must be at least ${minimum}`);
  }
  assert.equal(pkg.dependencies['@apimind/mockjs-safe'], 'file:vendor/mockjs-safe');
  assert.equal(pkg.devDependencies['markdown-it-include'], '^2.0.0');
});

test('unsupported vulnerable packages are absent from the selected graph', () => {
  for (const name of ['mockjs', 'vm2', 'string']) {
    assert.equal(pkg.dependencies[name], undefined, `${name} must not be a direct dependency`);
    assert.equal(lock.packages[`node_modules/${name}`], undefined, `${name} must not be selected`);
  }
});

test('remaining vulnerable transitive families use fixed versions', () => {
  assert.ok(atLeast(lock.packages['node_modules/fast-uri'].version, '3.1.4'));
  assert.ok(atLeast(lock.packages['node_modules/lodash'].version, '4.18.1'));
  assert.equal(pkg.overrides['fast-uri'], '3.1.4');
  assert.equal(pkg.overrides.lodash, '4.18.1');
});

test('registry tarballs resolve only from the official npm registry', () => {
  for (const [path, metadata] of Object.entries(lock.packages)) {
    if (!metadata.resolved) continue;
    if (!/^https?:/.test(metadata.resolved)) continue;
    assert.ok(
      metadata.resolved.startsWith('https://registry.npmjs.org/'),
      `${path} resolves from non-official URL ${metadata.resolved}`
    );
  }
});
```

Add `node --test tests/security-baseline.test.mjs` before lint in
`scripts/verify.sh`.

- [x] **Step 2: Run the gate and verify RED**

Run: `node --test tests/security-baseline.test.mjs`

Expected: FAIL first because Axios 0.18.1 is below 1.18.1 and the safe local
Mock.js package is absent.

- [x] **Step 3: Verify syntax and commit the failing gate**

Run: `node --check tests/security-baseline.test.mjs && sh -n scripts/verify.sh && git diff --check`

Commit:

```bash
git add tests/security-baseline.test.mjs scripts/verify.sh
git commit -m "test: enforce web security baseline"
```

### Task 2: Vendor the official Mock.js core with the published NVD guard

**Files:**
- Create: `scripts/vendor-mockjs-safe.mjs`
- Create: `vendor/mockjs-safe/package.json`
- Create: `vendor/mockjs-safe/README.md`
- Generate: `vendor/mockjs-safe/index.js`
- Create: `test/common/mockjs-safe.test.js`

**Interfaces:**
- Consumes: official `mockjs@1.1.0` distribution currently installed from `https://registry.npmjs.org/mockjs/-/mockjs-1.1.0.tgz`.
- Produces: CommonJS package `@apimind/mockjs-safe` with the same exported `Mock` API and the CVE-2023-26158 dangerous-key guard.

- [x] **Step 1: Write the failing prototype-pollution regression test**

Create `test/common/mockjs-safe.test.js`:

```js
const test = require('ava');
const Mock = require('../../vendor/mockjs-safe');

test.afterEach.always(() => {
  delete Object.prototype.apimindPolluted;
});

test('safe Mock Util.extend rejects prototype-pollution keys', t => {
  const malicious = JSON.parse('{"__proto__":{"apimindPolluted":true}}');
  Mock.Util.extend({}, malicious);
  t.is({}.apimindPolluted, undefined);
});

test('safe Mock preserves template and Random.extend behavior', t => {
  Mock.Random.extend({ apimindTimestamp: () => 123 });
  const result = Mock.mock({ 'id|+1': 1, name: '@string', timestamp: '@apimindTimestamp' });
  t.is(result.id, 1);
  t.is(typeof result.name, 'string');
  t.is(result.timestamp, 123);
});
```

- [x] **Step 2: Run the focused test and verify RED**

Run: `npx ava test/common/mockjs-safe.test.js`

Expected: FAIL because `vendor/mockjs-safe` does not exist.

- [x] **Step 3: Add reproducible vendor metadata and generator**

Create `vendor/mockjs-safe/package.json`:

```json
{
  "name": "@apimind/mockjs-safe",
  "version": "1.1.0-apimind.1",
  "private": true,
  "main": "index.js",
  "license": "MIT"
}
```

Create `vendor/mockjs-safe/README.md` documenting official upstream Mock.js
1.1.0, its npm tarball URL and lockfile integrity, CVE-2023-26158, and the NVD
workaround. Create `scripts/vendor-mockjs-safe.mjs` that:

1. reads `node_modules/mockjs/dist/mock.js`;
2. asserts the exact vulnerable `for (name in options)` marker occurs once;
3. inserts `if (["__proto__", "constructor", "prototype"].includes(name)) continue` immediately inside that loop;
4. writes the result to `vendor/mockjs-safe/index.js`;
5. exits non-zero if the guard count is not exactly one.

Use this exact replacement body:

```js
const vulnerable = `\t        for (name in options) {
\t            src = target[name]`;
const guarded = `\t        for (name in options) {
\t            if (["__proto__", "constructor", "prototype"].includes(name)) continue
\t            src = target[name]`;
```

Run: `node scripts/vendor-mockjs-safe.mjs`

- [x] **Step 4: Verify GREEN and commit the safe vendor package**

Run:

```bash
npx ava test/common/mockjs-safe.test.js
node scripts/vendor-mockjs-safe.mjs
git diff --exit-code -- vendor/mockjs-safe/index.js
```

Expected: two tests pass and regeneration leaves no diff.

Commit:

```bash
git add scripts/vendor-mockjs-safe.mjs vendor/mockjs-safe test/common/mockjs-safe.test.js
git commit -m "fix: vendor prototype-safe mockjs runtime"
```

### Task 3: Upgrade the production dependency graph

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `common/utils.js`
- Modify: `common/mock-extra.js`
- Modify: `client/common.js`
- Modify: `client/components/AceEditor/mockEditor.js`
- Modify: `exts/yapi-plugin-advanced-mock/server.js`

**Interfaces:**
- Consumes: `@apimind/mockjs-safe` from Task 2 and the security floors from Task 1.
- Produces: an npm production graph already pre-validated in a temporary lockfile at zero HIGH and zero CRITICAL findings.

- [x] **Step 1: Install exact official direct versions**

Run through the official npm registry with audit upload disabled:

```bash
npm install --save --no-audit --no-fund \
  @apimind/mockjs-safe@file:vendor/mockjs-safe \
  axios@1.18.1 crypto-js@4.2.0 jsrsasign@11.1.3 sha.js@2.4.12 \
  underscore@1.13.8 json5@2.2.3 markdown-it@14.3.0 \
  markdown-it-anchor@9.2.1 markdown-it-table-of-contents@1.2.0 \
  json-schema-ref-parser@9.0.9 json-schema-faker@0.6.2 \
  jsondiffpatch@0.7.6 qs@6.15.3 swagger-client@3.37.7
npm install --save-dev --no-audit --no-fund markdown-it-include@2.0.0
npm uninstall --no-audit --no-fund mockjs vm2
npm pkg set overrides.fast-uri=3.1.4 overrides.lodash=4.18.1
npm install --no-audit --no-fund
```

Expected: dependency resolution succeeds without `--force` or
`--legacy-peer-deps`.

- [x] **Step 2: Switch the five Mock.js imports to the safe local package**

Replace only module specifiers from `mockjs` to `@apimind/mockjs-safe` in the
five listed files. Do not change call sites.

- [x] **Step 3: Run focused dependency and compatibility tests**

Run:

```bash
node --test tests/security-baseline.test.mjs
npx ava test/common/mockjs-safe.test.js test/common/common.test.js test/mock-extra.test.js
npm run smoke:schema-editor
npm run build
```

Expected: the security gate and focused compatibility tests pass and Vite
completes a host build.

- [x] **Step 4: Scan the selected lock graph locally**

Run the digest-pinned official Trivy 0.70.0 container with the existing
official GHCR database cache against the tracked Web tree. Write ignored JSON
evidence under the parent `.artifacts/security/web-remediation/` directory.

Expected: `0 HIGH / 0 CRITICAL`.

- [x] **Step 5: Commit the dependency remediation**

```bash
git add package.json package-lock.json common/utils.js common/mock-extra.js \
  client/common.js client/components/AceEditor/mockEditor.js \
  exts/yapi-plugin-advanced-mock/server.js
git commit -m "fix: upgrade web security dependencies"
```

### Task 4: Replace the vulnerable runtime base image

**Files:**
- Modify: `Dockerfile`
- Test: `tests/container-config.test.mjs`

**Interfaces:**
- Consumes: host-built `dist` assets.
- Produces: runtime-only Nginx image based on official digest `sha256:90d82b3358df5758b3c57d20f2565082ce6f744906e7dc09afd0096c1b8eb2b5`.

- [x] **Step 1: Extend the container boundary test and verify RED**

Update `tests/container-config.test.mjs` to require:

```js
assert.match(
  dockerfile,
  /^FROM nginxinc\/nginx-unprivileged:alpine-slim@sha256:90d82b3358df5758b3c57d20f2565082ce6f744906e7dc09afd0096c1b8eb2b5 AS runtime$/m
);
```

Retain the existing assertions that reject Node/npm/build commands.

Run: `node --test tests/container-config.test.mjs`

Expected: FAIL because the Dockerfile still selects the old Nginx 1.27 Alpine
digest.

- [x] **Step 2: Update only the runtime base line**

Set the Dockerfile first line to:

```dockerfile
FROM nginxinc/nginx-unprivileged:alpine-slim@sha256:90d82b3358df5758b3c57d20f2565082ce6f744906e7dc09afd0096c1b8eb2b5 AS runtime
```

Leave both `COPY` commands, port 8080, and the Nginx command unchanged.

- [x] **Step 3: Verify the boundary, build, and container smoke**

Run:

```bash
node --test tests/container-config.test.mjs
npm run build
docker build -t apimind-web:local .
npm run smoke:container
```

Expected: boundary test, host build, Docker packaging, and HTTP container smoke
all pass.

- [x] **Step 4: Scan the exported runtime image and commit**

Export `apimind-web:local` and scan it with the fixed official Trivy container
and current official database.

Expected: `0 HIGH / 0 CRITICAL`.

Commit:

```bash
git add Dockerfile tests/container-config.test.mjs
git commit -m "fix: refresh web runtime image"
```

### Task 5: Complete Web verification and integrate the parent workspace

**Files:**
- Modify: `docs/superpowers/plans/2026-07-23-web-security-remediation.md` (check completed steps)
- Modify in parent: `compatibility.yaml`
- Regenerate in parent: `COMPATIBILITY.md`
- Modify in parent: `docs/migration/final-report.md`
- Update parent gitlink: `web`

**Interfaces:**
- Consumes: the remediated Web commit and final filesystem/image scan reports.
- Produces: clean Web and parent commits with exact component pins and updated Web-only security evidence.

- [x] **Step 1: Run complete Web verification**

Run: `APIMIND_SKIP_INSTALL=1 ./scripts/verify.sh`

Expected: lint, structural tests, AVA tests, schema smoke, host build, runtime
container smoke, diff check, and clean-tree check pass.

- [x] **Step 2: Mark this plan complete and commit Web evidence references**

Check only actually completed boxes, run `git diff --check`, then commit:

```bash
git add docs/superpowers/plans/2026-07-23-web-security-remediation.md
git commit -m "docs: record web security remediation"
```

- [ ] **Step 3: Update parent pins and report**

Update the parent `web` gitlink to the final Web commit, set that exact SHA in
`compatibility.yaml`, regenerate `COMPATIBILITY.md`, and change only the Web
filesystem/image rows and explanatory text in `docs/migration/final-report.md`
to `0 / 0` with the new runtime image ID and current Trivy database metadata.

- [ ] **Step 4: Verify the integrated parent workspace**

Run from the parent repository:

```bash
node scripts/verify-component-pins.mjs
sh scripts/repo-split/check-app-tree.sh
make verify
```

Expected: component pins, unchanged App tree, and full parent verification
pass against the pending integration diff.

- [ ] **Step 5: Commit parent integration**

```bash
git add web compatibility.yaml COMPATIBILITY.md docs/migration/final-report.md
git commit -m "fix: integrate web security remediation"
```

- [ ] **Step 6: Verify the committed parent tree is recursively clean**

Run:

```bash
sh scripts/verify-clean-tree.sh
git status --porcelain=v1 --untracked-files=all
```

Expected: recursive clean-tree verification passes and status is empty.

Do not push unless the user explicitly requests it.
