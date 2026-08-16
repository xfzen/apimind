import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const webRoot = resolve(fileURLToPath(new URL('../', import.meta.url)));
const allowlistPath = resolve(
  webRoot,
  'scripts/typescript/runtime-js-allowlist.json'
);

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

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

test('Phase 1 boundary modules are TypeScript and absent from the JavaScript allowlist', async () => {
  const allowlist = JSON.parse(await readFile(allowlistPath, 'utf8'));
  const allowlistedPaths = new Set(allowlist.entries.map(entry => entry.path));

  for (const modulePath of phaseOneModules) {
    assert.equal(
      await exists(resolve(webRoot, `${modulePath}.ts`)),
      true,
      `${modulePath}.ts must exist`
    );
    assert.equal(
      await exists(resolve(webRoot, `${modulePath}.js`)),
      false,
      `${modulePath}.js must be removed`
    );
    assert.equal(
      allowlistedPaths.has(`${modulePath}.js`),
      false,
      `${modulePath}.js must be removed from the runtime allowlist`
    );
  }
});
