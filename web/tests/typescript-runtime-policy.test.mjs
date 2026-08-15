import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  collectRuntimeSources,
  prepareRuntimeBuildInputs,
  validateRuntimeJavaScript
} from '../scripts/typescript/runtime-inventory.mjs';

const sampleSources = [
  '../client/Application.js',
  '../client/components/Docs/MarkdownPreview.tsx',
  '../common/validators.js',
  '../exts/yapi-plugin-wiki/client.js',
  '../node_modules/jsondiffpatch/lib/contexts/context.js'
];

const allowedEntries = [
  { path: 'client/Application.js' },
  { path: 'common/validators.js' },
  { path: 'exts/yapi-plugin-wiki/client.js' }
];

async function createSourceFixture() {
  const webRoot = await mkdtemp(join(tmpdir(), 'apimind-runtime-policy-'));
  const outDir = join(webRoot, 'dist');
  const repositorySources = sampleSources.slice(0, 4).map(source =>
    join(webRoot, source.replace('../', ''))
  );
  const dependencySource = join(
    webRoot,
    'node_modules/jsondiffpatch/lib/contexts/context.js'
  );

  for (const source of [...repositorySources, dependencySource]) {
    await mkdir(join(source, '..'), { recursive: true });
    await writeFile(source, 'export default null;\n');
  }

  await mkdir(outDir, { recursive: true });
  await writeFile(
    join(outDir, 'bundle.js.map'),
    JSON.stringify({ version: 3, sources: sampleSources, names: [], mappings: '' })
  );

  return { webRoot, outDir };
}

test('collectRuntimeSources normalizes only repository runtime roots', async () => {
  const { webRoot, outDir } = await createSourceFixture();

  try {
    assert.deepEqual(await collectRuntimeSources(outDir, webRoot), [
      'client/Application.js',
      'client/components/Docs/MarkdownPreview.tsx',
      'common/validators.js',
      'exts/yapi-plugin-wiki/client.js'
    ]);
  } finally {
    await rm(webRoot, { recursive: true, force: true });
  }
});

test('collectRuntimeSources keeps the lexical map path when the output directory is a symlink', async () => {
  const fixtureRoot = await mkdtemp(join(tmpdir(), 'apimind-runtime-symlink-'));
  const webRoot = join(fixtureRoot, 'web');
  const realOutDir = join(fixtureRoot, 'nested/actual-output');
  const linkedOutDir = join(fixtureRoot, 'dist-link');
  const application = join(webRoot, 'client/Application.js');

  try {
    await mkdir(join(webRoot, 'client'), { recursive: true });
    await mkdir(realOutDir, { recursive: true });
    await writeFile(application, 'export default null;\n');
    await writeFile(
      join(realOutDir, 'bundle.js.map'),
      JSON.stringify({
        version: 3,
        sources: ['../web/client/Application.js'],
        names: [],
        mappings: ''
      })
    );
    await symlink(realOutDir, linkedOutDir, 'dir');

    assert.deepEqual(await collectRuntimeSources(linkedOutDir, webRoot), [
      'client/Application.js'
    ]);
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});

test('validateRuntimeJavaScript rejects new and unclassified runtime JavaScript', () => {
  const runtimeSources = sampleSources.slice(0, 4).map(source => source.replace('../', ''));
  const allowlist = { entries: allowedEntries };

  assert.deepEqual(validateRuntimeJavaScript(runtimeSources, allowlist), {
    violations: [],
    staleEntries: []
  });
  assert.deepEqual(
    validateRuntimeJavaScript([...runtimeSources, 'client/new-runtime.js'], allowlist)
      .violations,
    ['client/new-runtime.js']
  );
  assert.deepEqual(
    validateRuntimeJavaScript(runtimeSources, { entries: allowedEntries.slice(0, 2) })
      .violations,
    ['exts/yapi-plugin-wiki/client.js']
  );
});

test('prepareRuntimeBuildInputs creates the generated plugin module on a clean checkout', async () => {
  const webRoot = await mkdtemp(join(tmpdir(), 'apimind-runtime-inputs-'));
  const generator = join(webRoot, 'scripts/generate-plugin-module.js');
  const output = join(webRoot, 'client/plugin-module.js');

  try {
    await mkdir(join(webRoot, 'scripts'), { recursive: true });
    await mkdir(join(webRoot, 'client'), { recursive: true });
    await writeFile(
      generator,
      "require('node:fs').writeFileSync('client/plugin-module.js', 'generated\\n');\n"
    );

    await prepareRuntimeBuildInputs(webRoot);

    assert.equal(await readFile(output, 'utf8'), 'generated\n');
  } finally {
    await rm(webRoot, { recursive: true, force: true });
  }
});
