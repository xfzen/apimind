import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import test from 'node:test';
import { createServer } from 'vite';

const webRoot = resolve(new URL('../', import.meta.url).pathname);
const virtualRegistryId = '\0phase3-plugin-registry';

function registryBoundary(resultExpression) {
  return {
    name: 'phase3-plugin-registry-boundary',
    enforce: 'pre',
    resolveId(source, importer) {
      const normalizedImporter = importer?.split('?')[0].replaceAll('\\', '/');
      if (
        source === './plugin-module.js' &&
        /\/client\/plugin\.(?:js|ts)$/.test(normalizedImporter || '')
      ) {
        return virtualRegistryId;
      }
      return null;
    },
    load(id) {
      return id === virtualRegistryId
        ? `export default ${resultExpression};`
        : null;
    }
  };
}

async function loadPlugin(resultExpression) {
  const server = await createServer({
    root: webRoot,
    configFile: false,
    logLevel: 'silent',
    optimizeDeps: { noDiscovery: true, include: [] },
    plugins: [registryBoundary(resultExpression)],
    server: { middlewareMode: true }
  });

  try {
    return {
      module: await server.ssrLoadModule('/client/plugin'),
      close: () => server.close()
    };
  } catch (error) {
    await server.close();
    throw error;
  }
}

test('plugin hooks preserve errors, listener ordering, and component identity', async () => {
  const runtime = await loadPlugin('Promise.resolve({})');
  try {
    const { bind, default: plugin, emitHook, ready } = runtime.module;
    assert.throws(() => emitHook('missing'), {
      message: '不存在的hook name'
    });

    bind('import_data', value => Promise.resolve(`first:${value}`));
    bind('import_data', value => `second:${value}`);
    assert.deepEqual(await emitHook('import_data', 'payload'), [
      'first:payload',
      'second:payload'
    ]);

    const component = { name: 'phase3-component' };
    bind('third_login', component);
    assert.equal(emitHook('third_login'), component);
    assert.equal(await ready, true);
    assert.equal(plugin.emitHook, emitHook);
  } finally {
    await runtime.close();
  }
});

test('plugin ready resolves false when the generated registry rejects', async () => {
  const runtime = await loadPlugin(
    "Promise.reject(new Error('registry failed'))"
  );
  try {
    assert.equal(await runtime.module.ready, false);
  } finally {
    await runtime.close();
  }
});
