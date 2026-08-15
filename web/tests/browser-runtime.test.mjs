import assert from 'node:assert/strict';
import { readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test, { after, before } from 'node:test';
import { build, createServer } from 'vite';

const root = resolve(new URL('../', import.meta.url).pathname);
const requestModule = resolve(root, 'client/utils/request.js');
const outDir = join(tmpdir(), `apimind-web-runtime-${process.pid}`);

function walkFiles(directory) {
  return readdirSync(directory).flatMap(name => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? walkFiles(path) : [path];
  });
}

before(async () => {
  await build({
    root,
    configFile: resolve(root, 'vite.config.mjs'),
    logLevel: 'silent',
    build: {
      outDir,
      emptyOutDir: true,
      sourcemap: false
    }
  });
});

after(() => {
  rmSync(outDir, { recursive: true, force: true });
});

test('the request wrapper resolves the real Axios package instead of importing itself', async () => {
  const server = await createServer({
    root,
    configFile: resolve(root, 'vite.config.mjs'),
    logLevel: 'silent',
    server: { middlewareMode: true }
  });

  try {
    const resolvedAxios = await server.pluginContainer.resolveId('axios-runtime', requestModule);
    assert.ok(resolvedAxios);
    assert.notEqual(resolve(resolvedAxios.id), requestModule);
    assert.match(
      resolvedAxios.id,
      /node_modules\/(?:\.vite\/deps\/axios-runtime\.js(?:\?.*)?|axios\/index\.js)$/
    );
  } finally {
    await server.close();
  }
});

test('the production build packages runtime plugins instead of requesting source files', () => {
  const javascript = walkFiles(outDir)
    .filter(path => path.endsWith('.js'))
    .map(path => readFileSync(path, 'utf8'))
    .join('\n');

  assert.doesNotMatch(javascript, /\/exts\/yapi-plugin-(?:advanced-mock|wiki)\/client\.js/);
});

test('the production build includes the favicon referenced by index.html', () => {
  assert.equal(statSync(resolve(outDir, 'image/favicon.png')).isFile(), true);
});
