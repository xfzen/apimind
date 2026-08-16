import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';

import { createReduxRuntimeServer } from './support/vite-redux-runtime.mjs';

const pluginInitialState = { ready: true };
function pluginReducer(state = pluginInitialState) { return state; }

let runtime;
let middleware;
let root;
let create;

before(async () => {
  runtime = await createReduxRuntimeServer({ pluginReducers: { pluginCanary: pluginReducer } });
  [middleware, root, create] = await Promise.all([
    runtime.server.ssrLoadModule('/client/reducer/middleware/messageMiddleware.ts'),
    runtime.server.ssrLoadModule('/client/reducer/modules/reducer.ts'),
    runtime.server.ssrLoadModule('/client/reducer/create.ts')
  ]);
});
after(async () => runtime?.restore());

test('message middleware preserves pass-through, falsy action, and API error branches', () => {
  const next = action => ({ passed: action });
  assert.deepEqual(middleware.messageMiddleware()(next)({ type: 'ok' }), { passed: { type: 'ok' } });
  assert.equal(middleware.messageMiddleware()(next)(null), undefined);
  assert.deepEqual(
    middleware.messageMiddleware()(next)({ type: 'ignored', payload: { data: { errcode: 40011, errmsg: '登录' } } }),
    { passed: { type: 'ignored', payload: { data: { errcode: 40011, errmsg: '登录' } } } }
  );
  assert.throws(() => middleware.messageMiddleware()(next)({
    type: 'failed', payload: { data: { errcode: 400, errmsg: '失败' } }
  }), /失败/);
  assert.deepEqual(runtime.messages.at(-1), { level: 'error', text: '失败' });
});

test('message middleware preserves action.error message and generic fallback', () => {
  const next = () => 'next-result';
  assert.equal(middleware.messageMiddleware()(next)({ error: true, payload: { message: '网络错误' }, type: 'network' }), 'next-result');
  assert.deepEqual(runtime.messages.at(-1), { level: 'error', text: '网络错误' });
  assert.equal(middleware.messageMiddleware()(next)({ error: true, type: 'generic' }), 'next-result');
  assert.deepEqual(runtime.messages.at(-1), { level: 'error', text: '服务器错误' });
});

test('root reducer keeps fixed key order and accepts plugin reducers', () => {
  assert.deepEqual(Object.keys(root.fixedReducerModules), [
    'group', 'user', 'inter', 'interfaceCol', 'project', 'news',
    'addInterface', 'menu', 'follow', 'mockCol', 'template', 'docs'
  ]);
  const state = root.rootReducer(undefined, { type: '@@redux/INIT' });
  assert.equal(state.pluginCanary, pluginInitialState);
  assert.deepEqual(Object.keys(state).slice(0, 12), Object.keys(root.fixedReducerModules));
});

test('store accepts deep partial state and promise middleware runs before messages', async () => {
  const store = create.default({ menu: { curKey: '/typed' } });
  assert.equal(store.getState().menu.curKey, '/typed');
  assert.equal(store.getState().pluginCanary.ready, true);
  const result = await store.dispatch({
    type: 'promise-ok',
    payload: Promise.resolve({ data: { errcode: 0, errmsg: '成功', data: null } })
  });
  assert.equal(result.type, 'promise-ok');
  await assert.rejects(store.dispatch({
    type: 'promise-failed',
    payload: Promise.resolve({ data: { errcode: 500, errmsg: '异步失败', data: null } })
  }), /异步失败/);
});
