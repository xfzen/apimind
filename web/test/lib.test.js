import test from 'ava';

const rewire = require("rewire");
const lib = rewire('../common/lib.js');

test('testJsonEqual', t=>{
  let json1 = {
    a:"1",
    b:2,
    c:{
      t:3,
      x: [11,22]
    }
  };

  let json2 = {    
    c:{
      x: [11,22],
      t:3
    },
    b:2,
    a:"1"
  }
  t.true(lib.jsonEqual(json1, json1));
})

test('testJsonEqualBase', t=>{
  t.true(lib.jsonEqual(1,1));
})

test('testJsonEqualBaseString', t=>{
  t.true(lib.jsonEqual('2', '2'));
})


test('isDeepMatch matches a subset field', t=>{
  t.true(lib.isDeepMatch({a:'aaaaa', b:2}, {a:'aaaaa'}))
})

test('isDeepMatch matches a nested subset', t=>{
  t.true(lib.isDeepMatch({a:1, b:2, c: {t:'ttt'}}, {c: {t:'ttt'}}))
})

test('isDeepMatch treats undefined expectation as match', t=>{
  t.true(lib.isDeepMatch({}, undefined))
})

test('isDeepMatch treats undefined source and empty expectation as match', t=>{
  t.true(lib.isDeepMatch(undefined, {}))
})

test('isDeepMatch rejects undefined source with required fields', t=>{
  t.false(lib.isDeepMatch(undefined, {a:1}))
})

test('isDeepMatch matches compatible scalar string values', t=>{
  t.true(lib.isDeepMatch({ t: 1,
    b: '2',
    ip: '127.0.0.1',
    interface_id: 1857,
    ip_enable: true,
    params: { a: 'x', b: 'y' },
    res_body: '111',
    code: 1 }, {t:'1'}))
})

test('isDeepMatch matches arrays of objects', t=>{
    t.true(lib.isDeepMatch({ t:[{a: 1}]}, { t:[{a: 1}]}))
  })

  test('isDeepMatch rejects partial object inside array', t=>{
    t.false(lib.isDeepMatch({ t:[{a: 1, b: 12}]}, { t:[{a: 1}]}))
  })

  test('isDeepMatch matches array root values', t=>{
    t.true(lib.isDeepMatch([{a: 1}], [{a: 1}]))
  })
