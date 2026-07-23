#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const manifestIndex = args.indexOf('--mcp-tools');
const fromStdin = args.includes('--stdin');

if ((manifestIndex === -1) === !fromStdin || (manifestIndex !== -1 && !args[manifestIndex + 1])) {
  console.error('usage: check-compatibility.mjs (--mcp-tools PATH | --stdin)');
  process.exit(2);
}

const contractSource = readFileSync(join(root, 'compatibility/server.yaml'), 'utf8');
const serverVersion = contractSource.match(/^server: (.+)$/m)?.[1];
const contractValue = (key) => contractSource.match(new RegExp(`^  ${key}: (.+)$`, 'm'))?.[1];
const requiredBlock = contractSource.match(/^required_tools:\n((?:  - .+\n?)+)/m)?.[1] ?? '';
const requiredTools = [...requiredBlock.matchAll(/^  - (.+)$/gm)].map((match) => match[1]);

let manifest;
try {
  const source = fromStdin ? readFileSync(0, 'utf8') : readFileSync(args[manifestIndex + 1], 'utf8');
  manifest = JSON.parse(source);
} catch (error) {
  console.error(`cannot read MCP manifest: ${error.message}`);
  process.exit(1);
}

const failures = [];
if (serverVersion !== '0.1.0') failures.push('unsupported server compatibility version');
if (contractValue('http_api') !== 'yapi-http-v1') failures.push('unsupported HTTP API compatibility version');
if (manifest.version !== contractValue('mcp')) failures.push(`expected MCP ${contractValue('mcp')}, got ${manifest.version ?? 'missing'}`);

const tools = new Map(Array.isArray(manifest.tools) ? manifest.tools.map((tool) => [tool.name, tool]) : []);
for (const name of requiredTools) {
  const tool = tools.get(name);
  if (!tool) {
    failures.push(`missing required MCP tool: ${name}`);
    continue;
  }
  for (const field of ['description', 'inputSchema', 'outputSchema']) {
    if (!tool[field] || (typeof tool[field] === 'object' && Object.keys(tool[field]).length === 0)) {
      failures.push(`${name} lacks ${field}`);
    }
  }
  if (typeof tool.readOnlyHint !== 'boolean') failures.push(`${name} lacks readOnlyHint`);
}

for (const name of ['list_workspaces', 'get_project', 'list_cats', 'get_interface']) {
  if (tools.get(name)?.readOnlyHint !== true) failures.push(`${name} must be read-only`);
}
for (const name of ['upsert_cat', 'upsert_interface']) {
  if (tools.get(name)?.readOnlyHint !== false) failures.push(`${name} must be a write tool`);
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(`compatible: server ${serverVersion}, HTTP ${contractValue('http_api')}, MCP ${manifest.version}`);
