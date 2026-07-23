#!/usr/bin/env node

import { existsSync, lstatSync, realpathSync, symlinkSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const rootIndex = args.indexOf('--root');
if (rootIndex !== -1 && !args[rootIndex + 1]) {
  console.error('usage: ensure-yapi-compat-alias.mjs [--root PATH]');
  process.exit(2);
}

const defaultRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const root = resolve(rootIndex === -1 ? defaultRoot : args[rootIndex + 1]);
const web = join(root, 'web');
const alias = join(root, 'yapi');

if (!existsSync(web) || !lstatSync(web).isDirectory()) {
  console.error(`web component is missing: ${web}`);
  process.exit(1);
}

try {
  const current = lstatSync(alias);
  if (current.isSymbolicLink()) {
    try {
      if (realpathSync(alias) === realpathSync(web)) {
        console.log('yapi compatibility alias already points to web');
        process.exit(0);
      }
    } catch {
      // A dangling or unreadable link is unsafe to replace automatically.
    }
  }
  console.error(`refusing to replace existing yapi path: ${alias}`);
  process.exit(1);
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

symlinkSync(process.platform === 'win32' ? web : 'web', alias, process.platform === 'win32' ? 'junction' : 'dir');
if (realpathSync(alias) !== realpathSync(web)) {
  console.error('created yapi alias does not resolve to web');
  process.exit(1);
}
console.log('created yapi compatibility alias -> web');
