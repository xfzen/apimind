import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'ava';

import {
  compileTypeScript,
  createMappedResolver
} from './typescript-loader.cjs';

const webRoot = path.resolve(__dirname, '..');
const loaderPath = path.resolve(__dirname, 'typescript-loader.cjs');

test('typescript loader transpiles TSX with the classic React runtime', t => {
  const output = compileTypeScript(
    'const view: JSX.Element = <span>loaded</span>; export default view;',
    '/tmp/component.tsx'
  );

  t.true(output.includes('React.createElement'));
});

test('typescript loader preserves legacy decorators and class-field semantics', t => {
  const output = compileTypeScript(
    [
      'function sealed(value: Function) { return value; }',
      '@sealed',
      'class Example { value: number = 1; }',
      'export default Example;'
    ].join('\n'),
    '/tmp/decorated.ts'
  );

  t.true(output.includes('__decorate'));
  t.true(output.includes('this.value = 1'));
});

test('typescript loader resolves only exact mapped legacy paths', t => {
  const legacyPath = path.resolve('/tmp/component.js');
  const targetPath = path.resolve('/tmp/component.tsx');
  const resolveMappedTarget = createMappedResolver(
    new Map([[legacyPath, targetPath]])
  );

  t.is(resolveMappedTarget(legacyPath), targetPath);
  t.is(resolveMappedTarget(path.resolve('/tmp/unmapped.js')), null);
});

test.serial('typescript loader executes mapped TSX and rejects unmapped requests', t => {
  const fixtureRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'apimind-typescript-loader-')
  );
  const legacyPath = path.join(fixtureRoot, 'component.js');
  const targetPath = path.join(fixtureRoot, 'component.tsx');
  const missingPath = path.join(fixtureRoot, 'missing.js');

  try {
    fs.writeFileSync(
      targetPath,
      [
        'const React = {',
        '  createElement(type: string, _props: unknown, ...children: unknown[]) {',
        '    return { type, children };',
        '  }',
        '};',
        'export default <span>loaded</span>;'
      ].join('\n')
    );

    const mapped = spawnSync(
      process.execPath,
      [
        '-e',
        [
          `const { registerTypeScriptLoader } = require(${JSON.stringify(loaderPath)});`,
          `registerTypeScriptLoader(new Map([[${JSON.stringify(legacyPath)}, ${JSON.stringify(targetPath)}]]));`,
          `const loaded = require(${JSON.stringify(legacyPath)}).default;`,
          `require('node:assert/strict').deepEqual(loaded, { type: 'span', children: ['loaded'] });`
        ].join('\n')
      ],
      { cwd: webRoot, encoding: 'utf8' }
    );
    t.is(mapped.status, 0, mapped.stderr || mapped.stdout);

    const unmapped = spawnSync(
      process.execPath,
      [
        '-e',
        [
          `const { registerTypeScriptLoader } = require(${JSON.stringify(loaderPath)});`,
          'registerTypeScriptLoader(new Map());',
          `require(${JSON.stringify(missingPath)});`
        ].join('\n')
      ],
      { cwd: webRoot, encoding: 'utf8' }
    );
    t.not(unmapped.status, 0);
    t.true(unmapped.stderr.includes('MODULE_NOT_FOUND'), unmapped.stderr);
  } finally {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  }
});
