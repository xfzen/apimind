import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import test from 'node:test';
import { createServer } from 'vite';

const webRoot = resolve(new URL('../', import.meta.url).pathname);

test('Project request descriptors preserve exact URLs, keys, and mutation identity', async () => {
  const server = await createServer({
    root: webRoot,
    configFile: resolve(webRoot, 'vite.config.mjs'),
    logLevel: 'silent',
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true }
  });

  try {
    const contracts = await server.ssrLoadModule(
      '/client/containers/Project/Interface/InterfaceList/requestContracts'
    );
    const params = { title: 'Updated interface' };
    const interfaceRequest = contracts.createInterfaceUpdateRequest(params, '31');
    assert.equal(interfaceRequest.url, '/api/interface/up');
    assert.equal(interfaceRequest.body, params);
    assert.deepEqual(interfaceRequest.body, { title: 'Updated interface', id: '31' });

    assert.deepEqual(contracts.createProjectTagUpdateRequest(21, [{ name: 'stable' }]), {
      url: '/api/project/up_tag',
      body: { id: 21, tag: [{ name: 'stable' }] }
    });
    const schema = { type: 'object' };
    assert.deepEqual(contracts.createSchemaPreviewRequest(schema), {
      url: '/api/interface/schema2json',
      body: { schema }
    });
  } finally {
    await server.close();
  }
});
