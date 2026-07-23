import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const upstream = `${root}node_modules/mockjs`;
const destination = `${root}vendor/mockjs-safe`;
const vulnerable = `\t        for (name in options) {
\t            src = target[name]`;
const guarded = `\t        for (name in options) {
\t            if (["__proto__", "constructor", "prototype"].includes(name)) continue
\t            src = target[name]`;

const source = readFileSync(`${upstream}/dist/mock.js`, 'utf8');
const markerCount = source.split(vulnerable).length - 1;
if (markerCount !== 1) {
  throw new Error(`expected one vulnerable Mock.js marker, found ${markerCount}`);
}

const result = source.replace(vulnerable, guarded);
const guardCount = result.split(guarded).length - 1;
if (guardCount !== 1) {
  throw new Error(`expected one Mock.js guard, found ${guardCount}`);
}

mkdirSync(destination, { recursive: true });
writeFileSync(`${destination}/index.js`, result);
copyFileSync(`${upstream}/LICENSE`, `${destination}/LICENSE`);
