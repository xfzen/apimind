import fs from 'node:fs';
import path from 'node:path';

const packageJson = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const groups = [
  ['runtime', packageJson.dependencies || {}],
  ['dev', packageJson.devDependencies || {}]
];

for (const [group, deps] of groups) {
  for (const [name, range] of Object.entries(deps).sort(([a], [b]) => a.localeCompare(b))) {
    let installed = 'not-installed';
    try {
      const pkgPath = path.join(process.cwd(), 'node_modules', name, 'package.json');
      installed = JSON.parse(fs.readFileSync(pkgPath, 'utf8')).version;
    } catch {
      installed = 'not-installed';
    }
    console.log(`${group}\t${name}\t${range}\t${installed}`);
  }
}
