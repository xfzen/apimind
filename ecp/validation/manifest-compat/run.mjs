import assert from 'node:assert/strict'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { readFileSync } from 'node:fs'

const [v0Path, v1Path] = process.argv.slice(2)
const v0 = JSON.parse(readFileSync(v0Path, 'utf8'))
const v1 = JSON.parse(readFileSync(v1Path, 'utf8'))

const knownFields = ['schema_version', 'product', 'instance_id', 'min_ecp_version', 'capabilities', 'resources', 'errors']
const decodeKnown = (manifest) => Object.fromEntries(knownFields.filter((key) => key in manifest).map((key) => [key, manifest[key]]))
const canonical = (value) => JSON.stringify(value, Object.keys(value).sort())
const secret = Buffer.from('gate0-fixture-secret')
const sign = (value) => createHmac('sha256', secret).update(canonical(value)).digest()
const verify = (value, signature) => timingSafeEqual(sign(value), signature)
const negotiate = (offered, supported) => offered.filter((item) => supported.includes(item))

assert.deepEqual(Object.keys(decodeKnown(v1)), knownFields)
assert.equal(decodeKnown(v1).unknown_top_level_field, undefined)
assert.deepEqual(negotiate(v1.capabilities, v0.capabilities), ['resource.list', 'resource.authorize'])
assert.deepEqual(v0.errors.filter((code) => v1.errors.includes(code)), v0.errors)

const signature = sign(decodeKnown(v1))
assert.equal(verify(decodeKnown(v1), signature), true)
assert.equal(verify({ ...decodeKnown(v1), product: 'tampered' }, signature), false)

const serverVersion = '1.0.0'
const compareVersion = (left, right) => left.localeCompare(right, undefined, { numeric: true })
assert.ok(compareVersion(serverVersion, v1.min_ecp_version) >= 0)
assert.throws(() => {
  if (v0.schema_version !== 'connector.manifest/v1') throw new Error('ECP_MANIFEST_DOWNGRADE_REFUSED')
}, /ECP_MANIFEST_DOWNGRADE_REFUSED/)

console.log('manifest N/N-1 compatibility prototype passed')
