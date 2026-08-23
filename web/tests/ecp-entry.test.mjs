import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import test, { after, before } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

import { mockRuntimeStub } from './support/vite-runtime.mjs';

const webRoot = resolve(fileURLToPath(new URL('../', import.meta.url)));
let server;
let capabilities;
let request;

before(async () => {
  server = await createServer({
    root: webRoot,
    configFile: resolve(webRoot, 'vite.config.mjs'),
    logLevel: 'silent',
    plugins: [mockRuntimeStub()],
    server: { middlewareMode: true }
  });
  capabilities = await server.ssrLoadModule('/client/services/enterpriseCapabilities.ts');
  request = (await server.ssrLoadModule('/client/utils/request.ts')).default;
});

after(async () => {
  await server?.close();
});

test('enterprise capability parser accepts only safe public entry points', () => {
  assert.deepEqual(
    capabilities.parseEnterpriseCapabilities({
      errcode: 0,
      errmsg: 'ok',
      data: {
        enterprise_enabled: true,
        enterprise_admin_url: 'https://admin.example.com/enterprise',
        enterprise_auth_start_path: '/api/enterprise/auth/start'
      }
    }),
    {
      status: 'enterprise',
      adminUrl: 'https://admin.example.com/enterprise',
      authStartPath: '/api/enterprise/auth/start'
    }
  );

  for (const authStartPath of ['https://evil.example.com/login', '//evil.example.com/login', '/user/login']) {
    assert.equal(
      capabilities.parseEnterpriseCapabilities({
        errcode: 0,
        errmsg: 'ok',
        data: {
          enterprise_enabled: true,
          enterprise_admin_url: 'https://admin.example.com',
          enterprise_auth_start_path: authStartPath
        }
      }).status,
      'unavailable'
    );
  }
});

test('community mode preserves the existing UI contract', () => {
  assert.deepEqual(
    capabilities.parseEnterpriseCapabilities({
      errcode: 0,
      errmsg: 'ok',
      data: { enterprise_enabled: false }
    }),
    { status: 'community', adminUrl: '', authStartPath: '' }
  );
});

test('member editing fails closed until community mode is confirmed', () => {
  assert.equal(capabilities.areEnterpriseMembersReadOnly({ status: 'loading', adminUrl: '', authStartPath: '' }), true);
  assert.equal(capabilities.areEnterpriseMembersReadOnly({ status: 'unavailable', adminUrl: '', authStartPath: '' }), true);
  assert.equal(capabilities.areEnterpriseMembersReadOnly({ status: 'community', adminUrl: '', authStartPath: '' }), false);
  assert.equal(
    capabilities.areEnterpriseMembersReadOnly({
      status: 'enterprise',
      adminUrl: 'https://admin.example.com',
      authStartPath: '/api/enterprise/auth/start'
    }),
    true
  );
});

test('logout never falls back to a legacy session when enterprise state is unknown', () => {
  assert.equal(capabilities.getSessionMode({ status: 'community', adminUrl: '', authStartPath: '' }), 'community');
  assert.equal(
    capabilities.getSessionMode({
      status: 'enterprise',
      adminUrl: 'https://admin.example.com',
      authStartPath: '/api/enterprise/auth/start'
    }),
    'enterprise'
  );
  assert.equal(capabilities.getSessionMode({ status: 'loading', adminUrl: '', authStartPath: '' }), 'blocked');
  assert.equal(capabilities.getSessionMode({ status: 'unavailable', adminUrl: '', authStartPath: '' }), 'blocked');
});

test('capabilities are loaded only through the Go same-origin API', async () => {
  let requestedUrl = '';
  request.defaults.adapter = async config => {
    requestedUrl = config.url;
    return {
      data: {
        errcode: 0,
        errmsg: 'ok',
        data: { enterprise_enabled: false }
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config
    };
  };

  const result = await capabilities.fetchEnterpriseCapabilities();
  assert.equal(requestedUrl, '/api/meta/capabilities');
  assert.equal(result.status, 'community');
});
