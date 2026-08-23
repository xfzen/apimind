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

const source = filesUnder(fileURLToPath(new URL('../src', import.meta.url)))
  .filter((path) => /\.(?:ts|tsx)$/.test(path))
  .map((path) => readFileSync(path, 'utf8'))
  .join('\n')

test('browser code uses only the same-origin ECP boundary', () => {
  assert.doesNotMatch(source, /https?:\/\/(?!127\.0\.0\.1|localhost)/)
  assert.doesNotMatch(source, /\/api\/(?:enforce|batch-enforce|add-policy|delete-policy)/)
  assert.doesNotMatch(source, /X-ECP-(?:Connector|Outbound)/)
  assert.match(source, /baseURL:\s*['"]\/api\/v1['"]/)
  assert.match(source, /['"]\/api\/v1\/auth\/start['"]/)
})
