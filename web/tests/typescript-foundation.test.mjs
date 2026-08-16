import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';

const webRoot = resolve(new URL('../', import.meta.url).pathname);
const repositoryRoot = resolve(webRoot, '..');

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

test('TypeScript compiler and direct declaration dependencies are pinned', async () => {
  const pkg = await readJson(resolve(webRoot, 'package.json'));

  assert.equal(pkg.devDependencies.typescript, '5.9.3');
  assert.equal(pkg.devDependencies['@types/react'], '18.3.31');
  assert.equal(pkg.devDependencies['@types/react-dom'], '18.3.7');
  assert.equal(pkg.devDependencies['@types/react-router'], '5.1.20');
  assert.equal(pkg.devDependencies['@types/react-router-dom'], '5.3.3');
  assert.equal(pkg.devDependencies['@types/redux-promise'], '0.5.32');
  assert.equal(pkg.devDependencies['@types/core-decorators'], '0.20.0');
  assert.equal(pkg.devDependencies['@types/crypto-js'], '4.2.2');
  assert.equal(pkg.devDependencies['@types/md5'], '2.3.6');
  assert.equal(pkg.devDependencies['@types/prop-types'], '15.7.15');
  assert.equal(pkg.devDependencies['@types/underscore'], '1.13.0');
  assert.equal(pkg.devDependencies['@types/node'], '22.20.0');
  assert.equal(pkg.devDependencies['@playwright/test'], '1.62.1');
  assert.equal(pkg.dependencies.dompurify, '3.4.13');
  assert.equal(pkg.scripts.typecheck, 'tsc --project tsconfig.json --pretty false');
});

test('tsconfig enables strict no-emit checking for repository TypeScript roots', async () => {
  const tsconfig = await readJson(resolve(webRoot, 'tsconfig.json'));
  const options = tsconfig.compilerOptions;

  assert.equal(options.strict, true);
  assert.equal(options.noEmit, true);
  assert.equal(options.allowJs, true);
  assert.equal(options.checkJs, false);
  assert.equal(options.experimentalDecorators, true);
  assert.equal(options.useDefineForClassFields, false);
  assert.equal(options.emitDecoratorMetadata, false);
  assert.deepEqual(tsconfig.include, [
    'client/**/*.ts',
    'client/**/*.tsx',
    'common/**/*.ts',
    'common/**/*.tsx',
    'playwright.config.ts',
    'playwright.live.config.ts',
    'tests/browser/**/*.ts',
    'tests/fixtures/**/*.tsx',
    'types/**/*.d.ts'
  ]);
  assert.equal(tsconfig.include.some(path => path === 'exts' || path.startsWith('exts/')), false);
});

test('browser globals and the root Web test target enforce type checking', async () => {
  const [globals, makefile] = await Promise.all([
    readFile(resolve(webRoot, 'types/browser-globals.d.ts'), 'utf8'),
    readFile(resolve(repositoryRoot, 'Makefile'), 'utf8')
  ]);

  assert.match(globals, /declare global \{\s+const __YAPI_API_BASE__: string;/);
  assert.match(globals, /interface Window \{/);
  assert.match(globals, /API_BASE\?: string;/);
  assert.match(globals, /Buffer\?: typeof import\('buffer'\)\.Buffer;/);
  assert.match(globals, /global\?: Window;/);
  assert.match(makefile, /cd web && npm run typecheck/);
});
