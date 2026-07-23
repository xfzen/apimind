const test = require('ava');
const Mock = require('../../vendor/mockjs-safe');

test.afterEach.always(() => {
  delete Object.prototype.apimindPolluted;
});

test('safe Mock Util.extend rejects prototype-pollution keys', t => {
  const malicious = JSON.parse('{"__proto__":{"apimindPolluted":true}}');
  Mock.Util.extend({}, malicious);
  t.is({}.apimindPolluted, undefined);
});

test('safe Mock preserves template and Random.extend behavior', t => {
  Mock.Random.extend({ apimindTimestamp: () => 123 });
  const result = Mock.mock({ 'id|+1': 1, name: '@string', timestamp: '@apimindTimestamp' });
  t.is(result.id, 1);
  t.is(typeof result.name, 'string');
  t.is(result.timestamp, 123);
});
