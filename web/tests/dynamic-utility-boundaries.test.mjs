import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import test, { after, before } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const webRoot = resolve(fileURLToPath(new URL('../', import.meta.url)));

let clientCommon;
let diffView;
let handleImportData;
let mockExtra;
let powerString;
let server;

before(async () => {
  server = await createServer({
    root: webRoot,
    configFile: resolve(webRoot, 'vite.config.mjs'),
    logLevel: 'silent',
    plugins: [
      {
        name: 'phase-one-dynamic-mock-runtime-stub',
        enforce: 'pre',
        resolveId(id) {
          return id === '@apimind/mockjs-safe' ? '\0phase-one-dynamic-mock' : null;
        },
        load(id) {
          return id === '\0phase-one-dynamic-mock'
            ? 'export default { Random: { extend() {} }, mock: value => value };'
            : null;
        }
      }
    ],
    server: { middlewareMode: true }
  });
  [clientCommon, { default: diffView }, { default: handleImportData }, { default: mockExtra }, powerString] =
    await Promise.all([
      server.ssrLoadModule('/client/common.ts'),
      server.ssrLoadModule('/common/diff-view.ts'),
      server.ssrLoadModule('/common/HandleImportData.ts'),
      server.ssrLoadModule('/common/mock-extra.ts'),
      server.ssrLoadModule('/common/power-string.ts')
    ]);
});

after(async () => {
  await server?.close();
});

test('PowerString preserves chained transforms and invalid-filter rejection', () => {
  assert.equal(powerString.filter('hello | upper | concat: !'), 'HELLO!');
  assert.equal(powerString.filter('abcd | length'), 4);
  assert.throws(() => powerString.filter('hello | missing'), /method name\(missing\)/);
});

test('MockExtra resolves nested context values and regexp filters', () => {
  const result = mockExtra(
    { greeting: '${user.name}', 'code|regexp': '^ok$' },
    { user: { name: 'Ada' } }
  );

  assert.equal(result.greeting, 'Ada');
  assert.equal(result.code instanceof RegExp, true);
  assert.equal(result.code.source, '^ok$');
});

test('client common helpers preserve path and immutable assignment behavior', () => {
  assert.equal(clientCommon.handlePath(' users/ '), '/users');
  assert.equal(clientCommon.handlePath('/'), '');
  assert.equal(clientCommon.handleApiPath('users'), '/users');
  assert.deepEqual(
    clientCommon.safeAssign({ id: 1, name: 'old' }, { name: 'new', extra: true }),
    { id: 1, name: 'new' }
  );
});

test('diff view keeps wiki changes and filters unchanged values', () => {
  const jsondiffpatch = {
    diff(left, right) {
      return left === right ? undefined : { left, right };
    }
  };
  const formattersHtml = {
    format(delta) {
      return delta ? `${delta.left} -> ${delta.right}` : '';
    }
  };

  assert.deepEqual(
    diffView(jsondiffpatch, formattersHtml, {
      type: 'wiki',
      old: 'before',
      current: 'after'
    }),
    [{ title: 'wiki更新', content: 'before -> after' }]
  );
  assert.deepEqual(
    diffView(jsondiffpatch, formattersHtml, {
      type: 'wiki',
      old: 'same',
      current: 'same'
    }),
    []
  );
});

test('empty imported API data reports the existing error without network calls', async () => {
  const errors = [];
  const successes = [];
  const states = [];

  await handleImportData(
    { cats: [], apis: [] },
    7,
    11,
    [],
    '',
    'normal',
    message => errors.push(message),
    message => successes.push(message),
    state => states.push(state),
    'token',
    18889
  );

  assert.deepEqual(errors, ['解析数据为空']);
  assert.deepEqual(successes, []);
  assert.deepEqual(states, [{ showLoading: false }]);
});
