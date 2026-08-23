import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

function filesUnder(root) {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name)
    return entry.isDirectory() ? filesUnder(path) : [path]
  })
}

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const css = readFileSync(new URL('../src/styles/index.css', import.meta.url), 'utf8')
const app = readFileSync(new URL('../src/app/App.tsx', import.meta.url), 'utf8')
const main = readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8')
const vite = readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf8')
const tsx = filesUnder(fileURLToPath(new URL('../src', import.meta.url))).filter((path) => path.endsWith('.tsx')).map((path) => readFileSync(path, 'utf8')).join('\n')

test('keeps Ant Design and Tailwind responsibilities separate', () => {
  for (const [name, version] of Object.entries({ ...pkg.dependencies, ...pkg.devDependencies })) assert.doesNotMatch(String(version), /^(?:\^|~|>|<|latest$|workspace:|file:)/, `${name} must be exact`)
  assert.equal(pkg.dependencies.antd, '6.4.3')
  assert.equal(pkg.dependencies['@ant-design/icons'], '6.2.3')
  assert.equal(pkg.dependencies['react-router'], '7.18.0')
  assert.match(pkg.devDependencies.tailwindcss, /^4\.\d+\.\d+$/)
  assert.match(pkg.devDependencies['@tailwindcss/vite'], /^4\.\d+\.\d+$/)
  assert.doesNotMatch(css, /@import\s+["']tailwindcss["']/)
  assert.match(css, /@import\s+["']tailwindcss\/theme\.css["']/)
  assert.match(css, /@import\s+["']tailwindcss\/utilities\.css["']/)
  assert.doesNotMatch(css, /preflight\.css/)
  assert.doesNotMatch(css, /\.ant-[a-z0-9-]+/i)
  assert.doesNotMatch(tsx, /(?:bg|text|border)-\[#[0-9a-f]+\]/i)
  assert.match(tsx, /className=.*\b(?:flex|grid|gap-|p-|m-|w-)/)
  assert.match(vite, /@tailwindcss\/vite/)
  assert.match(vite, /tailwindcss\(\)/)
  assert.match(app, /ConfigProvider/)
  assert.match(app, /<AntApp>/)
  assert.match(main, /BrowserRouter/)
  assert.equal((main.match(/styles\/index\.css/g) ?? []).length, 1)
})
