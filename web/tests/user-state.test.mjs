import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import test, { after, before } from 'node:test';
import { createServer } from 'vite';

import { mockRuntimeStub } from './support/vite-runtime.mjs';

const root = resolve(new URL('../', import.meta.url).pathname);

let server;
let userModule;
let selectors;

const member = {
  _id: 7,
  id: 7,
  uid: 7,
  username: 'pilot',
  email: 'pilot@example.invalid',
  role: 'admin',
  type: 'site',
  study: true
};

function resolvedAction(type, response) {
  return {
    type,
    payload: {
      data: response
    }
  };
}

before(async () => {
  server = await createServer({
    root,
    configFile: resolve(root, 'vite.config.mjs'),
    logLevel: 'silent',
    plugins: [mockRuntimeStub()],
    server: { middlewareMode: true }
  });
  userModule = await server.ssrLoadModule('/client/reducer/modules/user.ts');
  selectors = await server.ssrLoadModule('/client/reducer/selectors/user.ts');
});

after(async () => {
  await server?.close();
});

test('unauthenticated status produces guest state with nullable identity', () => {
  const state = userModule.userReducer(
    undefined,
    resolvedAction(userModule.userActionTypes.GET_LOGIN_STATE, {
      errcode: 40011,
      errmsg: '未登录',
      data: null,
      ladp: false,
      canRegister: true
    })
  );

  assert.equal(state.isLogin, false);
  assert.equal(state.loginState, 1);
  assert.equal(state.userName, null);
  assert.equal(state.uid, null);
  assert.equal(state.role, null);
  assert.equal(state.type, null);
  assert.equal(state.study, false);
  assert.equal(state.isLDAP, false);
  assert.equal(state.canRegister, true);
});

test('authenticated status produces member state', () => {
  const state = userModule.userReducer(
    undefined,
    resolvedAction(userModule.userActionTypes.GET_LOGIN_STATE, {
      errcode: 0,
      errmsg: '成功！',
      data: member,
      ladp: false,
      canRegister: true
    })
  );

  assert.equal(state.isLogin, true);
  assert.equal(state.loginState, 2);
  assert.equal(state.userName, 'pilot');
  assert.equal(state.uid, 7);
  assert.equal(state.role, 'admin');
  assert.equal(state.type, 'site');
  assert.equal(state.study, true);
});

test('successful login produces member state', () => {
  const state = userModule.userReducer(
    undefined,
    resolvedAction(userModule.userActionTypes.LOGIN, {
      errcode: 0,
      errmsg: '成功！',
      data: member
    })
  );

  assert.equal(state.isLogin, true);
  assert.equal(state.loginState, 2);
  assert.equal(state.userName, 'pilot');
  assert.equal(state.uid, 7);
});

test('failed login with null data preserves the previous state', () => {
  const previous = {
    ...userModule.initialUserState,
    loginState: 1,
    loginWrapActiveKey: '2'
  };
  const state = userModule.userReducer(
    previous,
    resolvedAction(userModule.userActionTypes.LOGIN, {
      errcode: 400,
      errmsg: '用户名或密码错误',
      data: null
    })
  );

  assert.equal(state, previous);
});

test('selectors expose authentication fields from the typed user root', () => {
  const state = {
    ...userModule.initialUserState,
    isLogin: true,
    loginState: 2,
    isLDAP: true,
    canRegister: false,
    loginWrapActiveKey: '2'
  };
  const rootState = { user: state };

  assert.equal(selectors.selectUser(rootState), state);
  assert.equal(selectors.selectLoginState(rootState), 2);
  assert.equal(selectors.selectIsAuthenticated(rootState), true);
  assert.equal(selectors.selectIsLdap(rootState), true);
  assert.equal(selectors.selectCanRegister(rootState), false);
  assert.equal(selectors.selectLoginWrapActiveKey(rootState), '2');
});
