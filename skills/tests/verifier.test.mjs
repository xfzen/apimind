import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'apimind-skills-verifier-'));
  for (const path of ['.codex-plugin', 'skills', 'compatibility', 'docs', 'examples', 'scripts']) {
    cpSync(join(root, path), join(directory, path), { recursive: true });
  }
  for (const path of ['README.md', 'README.en.md', 'LICENSE', 'CONTRIBUTING.md', 'SECURITY.md', 'MIGRATION.md']) {
    if (existsSync(join(root, path))) cpSync(join(root, path), join(directory, path));
  }
  return directory;
}

function verify(directory) {
  return spawnSync('bash', [join(directory, 'scripts/verify.sh'), '--root', directory, '--package-check'], {
    cwd: directory,
    encoding: 'utf8',
  });
}

test('package verifier accepts the publishable package', () => {
  const directory = fixture();
  try {
    const result = verify(directory);
    assert.equal(result.status, 0, result.stderr || result.stdout);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

for (const scenario of [
  {
    name: 'missing English README',
    mutate(directory) {
      rmSync(join(directory, 'README.en.md'), { force: true });
    },
  },
  {
    name: 'missing Chinese docs index',
    mutate(directory) {
      rmSync(join(directory, 'docs/README.md'), { force: true });
    },
  },
  {
    name: 'missing English docs index',
    mutate(directory) {
      rmSync(join(directory, 'docs/README.en.md'), { force: true });
    },
  },
  {
    name: 'missing reciprocal language link',
    mutate(directory) {
      const path = join(directory, 'README.md');
      const source = readFileSync(path, 'utf8').replace('(README.en.md)', '(README.md)');
      writeFileSync(path, source);
    },
  },
  {
    name: 'missing Chinese Quick Start',
    mutate(directory) {
      const path = join(directory, 'README.md');
      const source = readFileSync(path, 'utf8').replace('## Quick Start', '## 安装');
      writeFileSync(path, source);
    },
  },
  {
    name: 'missing Chinese documentation section',
    mutate(directory) {
      const path = join(directory, 'README.md');
      const source = readFileSync(path, 'utf8').replace('## 文档列表', '## 资料');
      writeFileSync(path, source);
    },
  },
  {
    name: 'missing English Quick Start',
    mutate(directory) {
      const path = join(directory, 'README.en.md');
      const source = readFileSync(path, 'utf8').replace('## Quick Start', '## Install');
      writeFileSync(path, source);
    },
  },
  {
    name: 'missing English documentation section',
    mutate(directory) {
      const path = join(directory, 'README.en.md');
      const source = readFileSync(path, 'utf8').replace('## Documentation', '## References');
      writeFileSync(path, source);
    },
  },
  {
    name: 'invalid metadata',
    mutate(directory) {
      const path = join(directory, '.codex-plugin/plugin.json');
      const manifest = JSON.parse(readFileSync(path, 'utf8'));
      manifest.license = 'MIT';
      writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`);
    },
  },
  {
    name: 'broken internal link',
    mutate(directory) {
      writeFileSync(join(directory, 'README.md'), '\n[missing](docs/missing.md)\n', { flag: 'a' });
    },
  },
  {
    name: 'machine-local absolute path',
    mutate(directory) {
      const privatePath = ['', 'Users', 'example', 'private'].join('/');
      writeFileSync(join(directory, 'README.md'), `\n${privatePath}\n`, { flag: 'a' });
    },
  },
  {
    name: 'private domain',
    mutate(directory) {
      const privateURL = ['https://api.customer', 'internal'].join('.');
      writeFileSync(join(directory, 'README.md'), `\n${privateURL}\n`, { flag: 'a' });
    },
  },
  {
    name: 'suspected token',
    mutate(directory) {
      writeFileSync(join(directory, 'README.md'), `\nghp_${'a'.repeat(36)}\n`, { flag: 'a' });
    },
  },
  {
    name: 'business code in a skill',
    mutate(directory) {
      writeFileSync(join(directory, 'skills/apimind-contract/helper.js'), 'fetch("https://example.invalid")\n');
    },
  },
  {
    name: 'missing write confirmation text',
    mutate(directory) {
      const path = join(directory, 'skills/apimind-contract/SKILL.md');
      const source = readFileSync(path, 'utf8').replaceAll('user explicitly asks', 'agent decides');
      writeFileSync(path, source);
    },
  },
]) {
  test(`package verifier rejects ${scenario.name}`, () => {
    const directory = fixture();
    try {
      scenario.mutate(directory);
      const result = verify(directory);
      assert.notEqual(result.status, 0, `${scenario.name} unexpectedly passed`);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
}
