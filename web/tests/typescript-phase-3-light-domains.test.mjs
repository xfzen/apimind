import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import test from 'node:test';
import { createServer } from 'vite';

const webRoot = resolve(new URL('../', import.meta.url).pathname);
const virtualInterfaceColId = '\0phase3-interface-col';

const interfaceColBoundary = {
  name: 'phase3-interface-col-boundary',
  enforce: 'pre',
  resolveId(source, importer) {
    const normalizedImporter = importer?.split('?')[0].replaceAll('\\', '/');
    if (
      source === '../../reducer/modules/interfaceCol' &&
      /\/client\/components\/ModalPostman\/VariablesSelect\.(?:js|tsx)$/.test(normalizedImporter || '')
    ) {
      return virtualInterfaceColId;
    }
    return null;
  },
  load(id) {
    return id === virtualInterfaceColId
      ? 'export function fetchVariableParamsList() {}'
      : null;
  }
};

async function loadModule(path) {
  const server = await createServer({
    root: webRoot,
    configFile: resolve(webRoot, 'vite.config.mjs'),
    logLevel: 'silent',
    optimizeDeps: { noDiscovery: true, include: [] },
    plugins: [interfaceColBoundary],
    server: { middlewareMode: true }
  });

  try {
    return {
      module: await server.ssrLoadModule(path),
      close: () => server.close()
    };
  } catch (error) {
    await server.close();
    throw error;
  }
}

test('method list cloning does not retain nested array identity', async () => {
  const runtime = await loadModule('/client/components/ModalPostman/MethodsList');
  try {
    const source = [{ name: 'sha', params: ['sha1'] }];
    const clone = runtime.module.deepEqual(source);

    assert.deepEqual(clone, source);
    assert.notEqual(clone, source);
    assert.notEqual(clone[0], source[0]);
    assert.notEqual(clone[0].params, source[0].params);
  } finally {
    await runtime.close();
  }
});

test('variable path helpers preserve object and array path boundaries', async () => {
  const runtime = await loadModule('/client/components/ModalPostman/VariablesSelect');
  try {
    assert.equal(runtime.module.deleteLastObject('$.case.params.field'), '$.case.params');
    assert.equal(runtime.module.deleteLastArr('$.case.body[0]'), '$.case.body');
  } finally {
    await runtime.close();
  }
});
