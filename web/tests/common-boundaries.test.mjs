import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import test, { after, before } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const webRoot = resolve(fileURLToPath(new URL('../', import.meta.url)));

let server;
let postman;
let sanitizer;
let schemaTable;
let utils;
let validators;

before(async () => {
  server = await createServer({
    root: webRoot,
    configFile: resolve(webRoot, 'vite.config.mjs'),
    logLevel: 'silent',
    plugins: [
      {
        name: 'phase-one-mock-runtime-stub',
        enforce: 'pre',
        resolveId(id) {
          return id === '@apimind/mockjs-safe' ? '\0phase-one-mock-runtime' : null;
        },
        load(id) {
          return id === '\0phase-one-mock-runtime'
            ? 'export default { mock: value => value };'
            : null;
        }
      }
    ],
    server: { middlewareMode: true }
  });
  [postman, sanitizer, schemaTable, utils, validators] = await Promise.all([
    server.ssrLoadModule('/common/postmanLib.ts'),
    server.ssrLoadModule('/common/sanitize.ts'),
    server.ssrLoadModule('/common/schema-transformTo-table.ts'),
    server.ssrLoadModule('/common/utils.ts'),
    server.ssrLoadModule('/common/validators.ts')
  ]);
});

after(async () => {
  await server?.close();
});

test('Postman helpers preserve content-type and request-body fallbacks', () => {
  assert.equal(
    postman.handleContentType({ 'Content-Type': 'application/json; charset=utf-8' }),
    'json'
  );
  assert.equal(postman.handleContentType({ Accept: 'text/plain' }), 'text');
  assert.equal(postman.checkRequestBodyIsRaw('GET', 'json'), false);
  assert.equal(postman.checkRequestBodyIsRaw('POST', 'json'), 'json');
  assert.equal(postman.handleCurrDomain([], 'missing'), undefined);
  assert.equal(
    postman.checkNameIsExistInArray('token', [{ name: 'token' }]),
    true
  );
});

test('schema table transformation preserves nested field metadata', () => {
  const rows = schemaTable.schemaTransformToTable({
    type: 'object',
    required: ['profile'],
    properties: {
      profile: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            title: 'Name',
            description: 'Display name',
            minLength: 1
          }
        }
      }
    }
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].name, 'profile');
  assert.equal(rows[0].required, true);
  assert.equal(rows[0].type, 'object');
  assert.equal(rows[0].children[0].name, 'name');
  assert.equal(rows[0].children[0].desc, 'Name\nDisplay name');
  assert.equal(rows[0].children[0].sub.minLength, 1);
});

test('value utilities retain parsing and validation fallbacks', () => {
  assert.equal(utils.simpleJsonPathParse('$.items[1].name', {
    items: [{ name: 'first' }, { name: 'second' }]
  }), 'second');
  assert.equal(utils.simpleJsonPathParse('items[1].name', {}), null);
  assert.deepEqual(utils.safeArray(null), []);
  assert.deepEqual(utils.isJson('{"ok":true}'), { ok: true });
  assert.equal(utils.isJson('{'), false);
  assert.deepEqual(utils.schemaValidator({ type: 'object', required: ['id'] }, {}), {
    valid: false,
    message: 'data 应当有必需属性 id'
  });
});

test('email rules resolve valid values and reject unsafe values', async () => {
  const rule = validators.emailRule('invalid email');
  await rule.validator(undefined, 'safe@example.com');
  await assert.rejects(
    rule.validator(undefined, 'unsafe@localhost'),
    /invalid email/
  );
});

test('sanitizer remains an exported runtime boundary', () => {
  assert.equal(typeof sanitizer.sanitizeHTML, 'function');
});
