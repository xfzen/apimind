import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import test, { after, before } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const webRoot = resolve(fileURLToPath(new URL('../', import.meta.url)));
const originalApiBase = process.env.YAPI_API_BASE;

let server;
let backend;
let request;

before(async () => {
  process.env.YAPI_API_BASE = 'http://localhost:4000/service/';
  server = await createServer({
    root: webRoot,
    configFile: resolve(webRoot, 'vite.config.mjs'),
    logLevel: 'silent',
    server: { middlewareMode: true }
  });
  backend = await server.ssrLoadModule('/client/utils/backend.ts');
  request = (await server.ssrLoadModule('/client/utils/request.ts')).default;
});

after(async () => {
  await server?.close();
  if (originalApiBase === undefined) {
    delete process.env.YAPI_API_BASE;
  } else {
    process.env.YAPI_API_BASE = originalApiBase;
  }
});

test('backend helpers preserve separated deployment URL behavior', () => {
  assert.equal(backend.getApiBase(), 'http://localhost:4000/service');
  assert.equal(backend.getBackendOrigin(), 'http://localhost:4000');
  assert.equal(
    backend.buildMockUrl(7, '/base', '/users'),
    'http://localhost:4000/mock/7/base/users'
  );
  assert.equal(
    backend.buildWsUrl('/api/socket'),
    'ws://localhost:4000/api/socket'
  );
  assert.equal(
    backend.buildApiUrl('/api/user/status'),
    'http://localhost:4000/api/user/status'
  );
});

test('request wrapper keeps the configured API base and credentials', () => {
  assert.equal(request.defaults.baseURL, 'http://localhost:4000/service');
  assert.equal(request.defaults.withCredentials, true);
  assert.equal(typeof request.isCancel, 'function');
  assert.equal(typeof request.all, 'function');
  assert.equal(typeof request.spread, 'function');
});
