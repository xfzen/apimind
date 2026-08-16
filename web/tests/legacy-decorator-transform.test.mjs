import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test, { after, before } from 'node:test';
import { createServer } from 'vite';

const root = resolve(new URL('../', import.meta.url).pathname);
const modules = [
  '/client/containers/Login/Login.tsx',
  '/client/containers/Login/Reg.tsx',
  '/client/containers/Login/LoginWrap.tsx',
  '/client/containers/Login/LoginContainer.tsx',
  '/tests/fixtures/legacy-decorator-canary.tsx'
];

let server;

before(async () => {
  server = await createServer({
    root,
    configFile: resolve(root, 'vite.config.mjs'),
    logLevel: 'silent',
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true }
  });
});

test('Vite preserves runtime Ant Design imports used only as JSX tags', async () => {
  const result = await server.transformRequest('/client/containers/Login/LoginContainer.tsx');

  assert.match(result.code, /import Row from/);
  assert.match(result.code, /import Col from/);
  assert.match(result.code, /import Card from/);
});

after(async () => {
  await server?.close();
});

test('Vite transforms typed legacy-decorator modules into JavaScript', async () => {
  for (const modulePath of modules) {
    const result = await server.transformRequest(modulePath);
    assert.ok(result?.code, `${modulePath} must produce transformed JavaScript`);
    assert.doesNotMatch(result.code, /\binterface\s+[A-Za-z_$]/);
  }
});

test('Vite keeps the reviewed legacy decorator and loose class-property settings', async () => {
  const config = await readFile(resolve(root, 'vite.config.mjs'), 'utf8');

  assert.match(config, /decorators-legacy/);
  assert.match(
    config,
    /plugin-proposal-decorators'\), \{ legacy: true \}/
  );
  assert.match(
    config,
    /plugin-proposal-class-properties'\), \{ loose: true \}/
  );
});
