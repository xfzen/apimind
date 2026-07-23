#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';

const root = resolve(process.argv[2] ?? '.');
const failures = [];
const requiredFiles = [
  '.codex-plugin/plugin.json',
  'README.md',
  'README.en.md',
  'docs/README.md',
  'docs/README.en.md',
  'LICENSE',
  'CONTRIBUTING.md',
  'SECURITY.md',
  'MIGRATION.md',
  'compatibility/server.yaml',
  'docs/apimind-contract-skill-maintenance-prompt.md',
  'examples/apimind-contract.yaml',
  'scripts/check-compatibility.mjs',
  'scripts/package-check.mjs',
  'scripts/verify.sh',
  'skills/apimind-contract/SKILL.md',
  'skills/apimind-project-config/SKILL.md',
];

for (const path of requiredFiles) {
  if (!existsSync(join(root, path))) failures.push(`missing required file: ${path}`);
}

const requiredSections = {
  'README.md': ['## 项目介绍', '## Quick Start', '## 文档列表'],
  'README.en.md': ['## Overview', '## Quick Start', '## Documentation'],
};
for (const [path, sections] of Object.entries(requiredSections)) {
  if (!existsSync(join(root, path))) continue;
  const source = readFileSync(join(root, path), 'utf8');
  for (const section of sections) {
    if (!source.includes(section)) failures.push(`missing required section in ${path}: ${section}`);
  }
}

const languageLinks = [
  ['README.md', 'README.en.md'],
  ['README.en.md', 'README.md'],
  ['docs/README.md', 'README.en.md'],
  ['docs/README.en.md', 'README.md'],
];
for (const [path, target] of languageLinks) {
  if (!existsSync(join(root, path))) continue;
  const source = readFileSync(join(root, path), 'utf8');
  if (!source.includes(`](${target})`)) failures.push(`missing language link in ${path}: ${target}`);
}

for (const path of ['README.md', 'README.en.md']) {
  if (!existsSync(join(root, path))) continue;
  const source = readFileSync(join(root, path), 'utf8');
  for (const fact of ['Node.js 22', 'apimind-mcp-v1', 'Apache-2.0']) {
    if (!source.includes(fact)) failures.push(`missing required fact in ${path}: ${fact}`);
  }
}

let manifest = {};
try {
  manifest = JSON.parse(readFileSync(join(root, '.codex-plugin/plugin.json'), 'utf8'));
} catch (error) {
  failures.push(`invalid plugin metadata: ${error.message}`);
}
if (manifest.name !== 'apimind') failures.push('plugin name must be apimind');
if (manifest.license !== 'Apache-2.0') failures.push('plugin license must be Apache-2.0');
if (manifest.skills !== './skills/') failures.push('plugin skills path must be ./skills/');
for (const field of ['homepage', 'repository']) {
  if (manifest[field] !== 'https://github.com/xfzen/apimind') failures.push(`plugin ${field} is invalid`);
}

if (existsSync(join(root, 'skills'))) {
  const skills = readdirSync(join(root, 'skills'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  if (skills.join(',') !== 'apimind-contract,apimind-project-config') failures.push(`unexpected skills: ${skills.join(', ')}`);
}

const files = [];
function walk(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === '.git') continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) walk(path);
    else if (entry.isFile()) files.push(path);
  }
}
walk(root);

const textExtensions = new Set(['.md', '.json', '.yaml', '.yml', '.mjs', '.sh', '']);
const secretPatterns = [
  /ghp_[A-Za-z0-9]{30,}/,
  /github_pat_[A-Za-z0-9_]{30,}/,
  /(?:api[_-]?key|token|secret)\s*[:=]\s*["']?[A-Za-z0-9_\-]{20,}/i,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
];
for (const path of files) {
  const name = relative(root, path);
  if (name.startsWith('skills/') && ['.go', '.js', '.ts', '.py'].includes(extname(path))) {
    failures.push(`business code is not allowed in skills: ${name}`);
  }
  if (!textExtensions.has(extname(path))) continue;
  const source = readFileSync(path, 'utf8');
  if (/\/Users\/[^\s)`"']+/.test(source)) failures.push(`machine-local absolute path in ${name}`);
  if (/https?:\/\/[^\s/)]+\.(?:internal|corp|lan)(?:[/:\s)]|$)/i.test(source)) failures.push(`private domain in ${name}`);
  if (secretPatterns.some((pattern) => pattern.test(source))) failures.push(`suspected credential in ${name}`);

  if (extname(path) === '.md') {
    for (const match of source.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)) {
      const target = match[1].trim().replace(/^<|>$/g, '').split('#')[0];
      if (!target || /^(?:https?:|mailto:)/.test(target)) continue;
      if (!existsSync(resolve(join(path, '..'), decodeURIComponent(target)))) failures.push(`broken internal link in ${name}: ${target}`);
    }
  }
}

const contractPath = join(root, 'skills/apimind-contract/SKILL.md');
if (existsSync(contractPath)) {
  const contract = readFileSync(contractPath, 'utf8');
  for (const phrase of [
    'Write only when the user explicitly asks',
    'Before writing, unless the user explicitly asked for direct execution',
    'do not write the interface',
    'Do not delete cat',
    'Do not delete interface',
  ]) {
    if (!contract.includes(phrase)) failures.push(`missing write safety phrase: ${phrase}`);
  }
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log('publishable package checks passed');
