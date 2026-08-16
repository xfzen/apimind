import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));
const lock = JSON.parse(readFileSync(new URL('../package-lock.json', import.meta.url)));
const requestSource = readFileSync(new URL('../client/utils/request.ts', import.meta.url), 'utf8');
const timelineSource = readFileSync(
  new URL('../client/components/TimeLine/TimeLine.js', import.meta.url),
  'utf8'
);
const viteConfigSource = readFileSync(new URL('../vite.config.mjs', import.meta.url), 'utf8');
const npmConfigSource = readFileSync(new URL('../.npmrc', import.meta.url), 'utf8');

const minimumDirectVersions = {
  axios: '1.18.1',
  'crypto-js': '4.2.0',
  jsrsasign: '11.1.3',
  'sha.js': '2.4.12',
  underscore: '1.13.8',
  json5: '2.2.3',
  'markdown-it': '14.3.0',
  'markdown-it-anchor': '9.2.1',
  'markdown-it-table-of-contents': '1.2.0',
  'json-schema-ref-parser': '9.0.9',
  'json-schema-faker': '0.6.2',
  jsondiffpatch: '0.7.6',
  qs: '6.15.3',
  'swagger-client': '3.37.7'
};

function numericVersion(value) {
  const match = String(value || '').match(/(\d+)\.(\d+)\.(\d+)/);
  assert.ok(match, `expected semantic version, found ${value}`);
  return match.slice(1).map(Number);
}

function atLeast(actual, minimum) {
  const left = numericVersion(actual);
  const right = numericVersion(minimum);
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) return left[index] > right[index];
  }
  return true;
}

test('security-sensitive direct dependencies meet approved floors', () => {
  for (const [name, minimum] of Object.entries(minimumDirectVersions)) {
    assert.ok(atLeast(pkg.dependencies[name], minimum), `${name} must be at least ${minimum}`);
  }
  assert.equal(pkg.dependencies['@apimind/mockjs-safe'], 'file:vendor/mockjs-safe');
  assert.equal(pkg.devDependencies['markdown-it-include'], '^2.0.0');
});

test('unsupported vulnerable packages are absent from the selected graph', () => {
  for (const name of ['mockjs', 'vm2', 'string']) {
    assert.equal(pkg.dependencies[name], undefined, `${name} must not be a direct dependency`);
    assert.equal(lock.packages[`node_modules/${name}`], undefined, `${name} must not be selected`);
  }
});

test('remaining vulnerable transitive families use fixed versions', () => {
  assert.ok(atLeast(lock.packages['node_modules/fast-uri'].version, '3.1.4'));
  assert.ok(atLeast(lock.packages['node_modules/lodash'].version, '4.18.1'));
  assert.equal(pkg.overrides['fast-uri'], '3.1.4');
  assert.equal(pkg.overrides.lodash, '4.18.1');
});

test('registry tarballs resolve only from the official npm registry', () => {
  for (const [path, metadata] of Object.entries(lock.packages)) {
    if (!metadata.resolved) continue;
    if (!/^https?:/.test(metadata.resolved)) continue;
    assert.ok(
      metadata.resolved.startsWith('https://registry.npmjs.org/'),
      `${path} resolves from non-official URL ${metadata.resolved}`
    );
  }
});

test('Axios uses its supported public package entrypoint', () => {
  assert.match(requestSource, /import realAxios from 'axios-runtime';/);
  assert.doesNotMatch(requestSource, /axios\/dist\/axios/);
});

test('jsondiffpatch uses its supported formatter and stylesheet exports', () => {
  assert.match(timelineSource, /jsondiffpatch\/formatters\/html/);
  assert.match(timelineSource, /jsondiffpatch\/formatters\/styles\/annotated\.css/);
  assert.match(timelineSource, /jsondiffpatch\/formatters\/styles\/html\.css/);
  assert.doesNotMatch(timelineSource, /jsondiffpatch\/dist\//);
});

test('Vite transforms the vendored CommonJS Mock.js package', () => {
  assert.match(viteConfigSource, /vendor\\\/mockjs-safe/);
});

test('npm downloads use only the official registry', () => {
  assert.match(npmConfigSource, /^registry=https:\/\/registry\.npmjs\.org\/$/m);
  assert.doesNotMatch(npmConfigSource, /taobao|npmmirror|registry\.yarnpkg/i);
});
