import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import test from 'node:test';
import { createServer } from 'vite';

const webRoot = resolve(new URL('../', import.meta.url).pathname);

test('Interface route selection preserves every legacy branch', async () => {
  const server = await createServer({
    root: webRoot,
    configFile: resolve(webRoot, 'vite.config.mjs'),
    logLevel: 'silent',
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true }
  });

  try {
    const { selectInterfaceRoute } = await server.ssrLoadModule(
      '/client/containers/Project/Interface/interfaceRoute'
    );

    assert.deepEqual(selectInterfaceRoute('21', 'api'), { kind: 'list' });
    assert.deepEqual(selectInterfaceRoute('21', 'api', '31'), { kind: 'content' });
    assert.deepEqual(selectInterfaceRoute('21', 'api', 'cat_8'), { kind: 'list' });
    assert.deepEqual(selectInterfaceRoute('21', 'api', 'missing'), { kind: 'unresolved' });
    assert.deepEqual(selectInterfaceRoute('21', 'col', '4'), { kind: 'collection' });
    assert.deepEqual(selectInterfaceRoute('21', 'case', '9'), { kind: 'case' });
    assert.deepEqual(selectInterfaceRoute('21', 'unknown'), {
      kind: 'redirect',
      path: '/project/21/interface/api'
    });
  } finally {
    await server.close();
  }
});
