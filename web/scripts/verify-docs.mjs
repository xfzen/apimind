// SPDX-License-Identifier: Apache-2.0

import { existsSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';

const configArgument = process.argv[2];
if (!configArgument) {
  console.error('usage: node verify-docs.mjs <config.json>');
  process.exit(1);
}

const configPath = resolve(process.cwd(), configArgument);
let config;
try {
  config = JSON.parse(readFileSync(configPath, 'utf8'));
} catch (error) {
  console.error(`unable to read config ${configPath}: ${error.message}`);
  process.exit(1);
}

const root = resolve(dirname(configPath), config.root ?? '.');
const failures = [];
const contents = new Map();

function report(message) {
  failures.push(message);
}

function readDocument(path) {
  if (contents.has(path)) {
    return contents.get(path);
  }

  const absolutePath = resolve(root, path);
  if (!existsSync(absolutePath)) {
    report(`required file missing: ${path}`);
    contents.set(path, null);
    return null;
  }

  const content = readFileSync(absolutePath, 'utf8');
  contents.set(path, content);
  return content;
}

function markdownTargets(content) {
  const targets = [];
  const pattern = /!?\[[^\]]*\]\(([^)]+)\)/g;
  for (const match of content.matchAll(pattern)) {
    let target = match[1].trim();
    if (target.startsWith('<')) {
      const close = target.indexOf('>');
      target = close === -1 ? target : target.slice(1, close);
    } else {
      target = target.split(/\s+["']/u, 1)[0];
    }
    targets.push(target);
  }
  return targets;
}

function withoutQueryOrFragment(target) {
  return target.split('#', 1)[0].split('?', 1)[0];
}

function isExternalTarget(target) {
  return /^(?:https?:|mailto:)/i.test(target) || target.startsWith('#');
}

for (const path of config.requiredFiles ?? []) {
  readDocument(path);
}

for (const [path, sections] of Object.entries(config.requiredSections ?? {})) {
  const content = readDocument(path);
  if (content === null) continue;
  for (const section of sections) {
    if (!content.includes(section)) {
      report(`required section missing in ${path}: ${section}`);
    }
  }
}

for (const pair of config.languageLinks ?? []) {
  const [source, target] = pair;
  const content = readDocument(source);
  if (content === null) continue;
  const targets = markdownTargets(content).map(withoutQueryOrFragment);
  if (!targets.includes(target)) {
    report(`language link missing in ${source}: ${target}`);
  }
}

for (const fact of config.sharedFacts ?? []) {
  for (const path of fact.files ?? []) {
    const content = readDocument(path);
    if (content !== null && !content.includes(fact.value)) {
      report(`shared fact missing in ${path}: ${fact.value}`);
    }
  }
}

for (const path of config.linkFiles ?? []) {
  const content = readDocument(path);
  if (content === null) continue;
  for (const rawTarget of markdownTargets(content)) {
    if (isExternalTarget(rawTarget)) continue;
    const target = withoutQueryOrFragment(rawTarget);
    if (!target) continue;
    const absoluteTarget = isAbsolute(target)
      ? target
      : resolve(root, dirname(path), target);
    if (!existsSync(absoluteTarget)) {
      report(`broken link in ${path}: ${rawTarget}`);
    }
  }
}

const scanFiles = new Set([
  ...(config.requiredFiles ?? []),
  ...(config.linkFiles ?? []),
  ...(config.surfaceFiles ?? []),
]);
const machinePathPattern = /(?:^|[\s`"'(])(?:\/Users\/[^\s`"')]+|\/home\/[^\s`"')]+|[A-Za-z]:\\Users\\[^\s`"')]+)/gmu;
const privateDomainPattern = /https?:\/\/[^\s`"')]+\.(?:internal|corp|lan)(?:[/:?#]|$)/giu;
const unofficialSourcePattern = /(?:registry\.npm\.taobao\.org|registry\.npmmirror\.com|goproxy\.cn|goproxy\.io|dockerproxy\.com|docker\.m\.daocloud\.io|mirrors\.aliyun\.com)/giu;

for (const path of scanFiles) {
  const content = readDocument(path);
  if (content === null) continue;

  const machinePath = content.match(machinePathPattern)?.[0]?.trim();
  if (machinePath) {
    report(`machine-local path in ${path}: ${machinePath}`);
  }

  const privateDomain = content.match(privateDomainPattern)?.[0];
  if (privateDomain) {
    report(`private domain in ${path}: ${privateDomain}`);
  }

  const unofficialSource = content.match(unofficialSourcePattern)?.[0];
  if (unofficialSource) {
    report(`unofficial source in ${path}: ${unofficialSource}`);
  }
}

for (const path of config.surfaceFiles ?? []) {
  const content = readDocument(path);
  if (content === null) continue;
  for (const term of config.forbiddenTerms ?? []) {
    if (content.includes(term)) {
      report(`forbidden term in ${path}: ${term}`);
    }
  }
}

if (failures.length > 0) {
  for (const failure of [...new Set(failures)]) {
    console.error(failure);
  }
  process.exit(1);
}

console.log('public documentation verification passed');
