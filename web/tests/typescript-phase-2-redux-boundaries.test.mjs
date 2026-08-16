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

const phaseTwoReduxModules = [
  'client/reducer/create',
  'client/reducer/middleware/messageMiddleware',
  'client/reducer/modules/addInterface',
  'client/reducer/modules/docs',
  'client/reducer/modules/follow',
  'client/reducer/modules/group',
  'client/reducer/modules/interface',
  'client/reducer/modules/interfaceCol',
  'client/reducer/modules/menu',
  'client/reducer/modules/mockCol',
  'client/reducer/modules/news',
  'client/reducer/modules/project',
  'client/reducer/modules/reducer',
  'client/reducer/modules/template'
];

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

test('Phase 2 Redux modules are TypeScript and absent from the JavaScript allowlist', async () => {
  const allowlist = JSON.parse(await readFile(allowlistPath, 'utf8'));
  const allowlistedPaths = new Set(allowlist.entries.map(entry => entry.path));

  for (const modulePath of phaseTwoReduxModules) {
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
