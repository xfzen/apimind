import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const contract = readFileSync(join(root, 'skills/apimind-contract/SKILL.md'), 'utf8');
const projectConfig = readFileSync(join(root, 'skills/apimind-project-config/SKILL.md'), 'utf8');

test('remote writes require explicit user intent and a confirmation checkpoint', () => {
  assert.match(contract, /Default to read-only\./);
  assert.match(contract, /Write only when the user explicitly asks/);
  assert.match(contract, /Before writing, unless the user explicitly asked for direct execution, output a short plan/);
  assert.match(contract, /If .* uncertain, do not write the interface\./);
  assert.match(contract, /Do not delete (cat|interface)/);
});

test('local project configuration never implies a remote write', () => {
  assert.match(projectConfig, /This is local project configuration, not an ApiMind MCP write\./);
  assert.match(projectConfig, /Never do these in this skill:/);
  assert.match(projectConfig, /Write remote ApiMind workspace\/project\/cat\/interface records\./);
});

test('skill tool references are covered by the declared compatibility contract', () => {
  const compatibility = readFileSync(join(root, 'compatibility/server.yaml'), 'utf8');
  for (const tool of ['list_workspaces', 'get_project', 'list_cats', 'get_interface', 'upsert_cat', 'upsert_interface']) {
    assert.match(contract, new RegExp(`\\b${tool}\\b`));
    assert.match(compatibility, new RegExp(`- ${tool}\\n`));
  }
});
