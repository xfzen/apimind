import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('plugin metadata is publishable and contains exactly two real skills', () => {
  const manifest = JSON.parse(readFileSync(join(root, '.codex-plugin/plugin.json'), 'utf8'));
  assert.equal(manifest.name, 'apimind');
  assert.equal(manifest.version, '0.1.0');
  assert.equal(manifest.license, 'Apache-2.0');
  assert.equal(manifest.skills, './skills/');
  for (const field of ['homepage', 'repository']) {
    assert.equal(manifest[field], 'https://github.com/xfzen/apimind');
  }
  for (const field of ['websiteURL', 'privacyPolicyURL', 'termsOfServiceURL']) {
    assert.equal(manifest.interface[field], 'https://github.com/xfzen/apimind');
  }

  const skills = readdirSync(join(root, 'skills'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  assert.deepEqual(skills, ['apimind-contract', 'apimind-project-config']);
  for (const name of skills) {
    const source = readFileSync(join(root, 'skills', name, 'SKILL.md'), 'utf8');
    assert.match(source, new RegExp(`^---\\nname: ${name}\\ndescription: Use when`, 'm'));
    assert.ok(source.indexOf('\n---\n') > 0, `${name} lacks closed YAML frontmatter`);
  }
});

test('published package contains no business-code-like files', () => {
  const forbiddenExtensions = new Set(['.go', '.ts', '.py']);
  const walk = (directory) => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
  for (const path of walk(root)) {
    if (path.includes(`${join(root, '.git')}/`) || path.includes(`${join(root, 'tests')}/`) || path.includes(`${join(root, 'scripts')}/`)) continue;
    const extension = path.slice(path.lastIndexOf('.'));
    assert.ok(!forbiddenExtensions.has(extension), `business-code-like file in package: ${path}`);
  }
});
