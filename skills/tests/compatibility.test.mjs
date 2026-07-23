import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('compatibility contract uses the published schema', () => {
  const source = readFileSync(join(root, 'compatibility/server.yaml'), 'utf8');
  assert.match(source, /^server: 0\.1\.0$/m);
  assert.match(source, /^contracts:\n  http_api: yapi-http-v1\n  mcp: apimind-mcp-v1$/m);
  assert.match(source, /^required_tools:$/m);
});

test('compatibility contract matches the committed MCP tool fixture', () => {
  const result = spawnSync(process.execPath, [
    join(root, 'scripts/check-compatibility.mjs'),
    '--mcp-tools', join(root, 'tests/fixtures/mcp-tools.json'),
  ], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test('compatibility check rejects a missing required MCP tool', () => {
  const fixture = JSON.parse(readFileSync(join(root, 'tests/fixtures/mcp-tools.json'), 'utf8'));
  fixture.tools = fixture.tools.filter((tool) => tool.name !== 'upsert_interface');
  const result = spawnSync(process.execPath, [
    join(root, 'scripts/check-compatibility.mjs'), '--stdin',
  ], { cwd: root, encoding: 'utf8', input: JSON.stringify(fixture) });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /upsert_interface/);
});
