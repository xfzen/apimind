import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';

import { createReduxRuntimeServer } from './support/vite-redux-runtime.mjs';

let runtime;
let menu;
let addInterface;
let follow;

before(async () => {
  runtime = await createReduxRuntimeServer({ locationHash: '#/group/11' });
  [menu, addInterface, follow] = await Promise.all([
    runtime.server.ssrLoadModule('/client/reducer/modules/menu.ts'),
    runtime.server.ssrLoadModule('/client/reducer/modules/addInterface.ts'),
    runtime.server.ssrLoadModule('/client/reducer/modules/follow.ts')
  ]);
});

after(async () => {
  await runtime?.restore();
});

test('menu reducer derives the current key and applies navigation changes', () => {
  assert.deepEqual(menu.initialState, { curKey: '/group' });

  const action = menu.changeMenuItem('/project');
  assert.deepEqual(action, {
    type: 'yapi/menu/CHANGE_MENU_ITEM',
    data: '/project'
  });
  assert.deepEqual(menu.menuReducer(menu.initialState, action), {
    curKey: '/project'
  });
});

test('add-interface reducer preserves every local state transition', () => {
  const clipboard = () => {};
  const cases = [
    [addInterface.pushInputValue('/users'), 'url', '/users'],
    [addInterface.reqTagValue('stable'), 'tagValue', 'stable'],
    [addInterface.reqHeaderValue('application/json'), 'headerValue', 'application/json'],
    [addInterface.addReqHeader([{ id: 1, name: 'Accept', value: '*/*' }]), 'seqGroup', [{ id: 1, name: 'Accept', value: '*/*' }]],
    [addInterface.deleteReqHeader([]), 'seqGroup', []],
    [addInterface.getReqParams('{"id":1}'), 'reqParams', '{"id":1}'],
    [addInterface.getResParams('{"ok":true}'), 'resParams', '{"ok":true}'],
    [addInterface.pushInterfaceName('Users'), 'interfaceName', 'Users'],
    [addInterface.pushInterfaceMethod('POST'), 'method', 'POST'],
    [addInterface.addInterfaceClipboard(clipboard), 'clipboard', clipboard]
  ];

  for (const [action, key, expected] of cases) {
    const next = addInterface.addInterfaceReducer(addInterface.initialState, action);
    assert.deepEqual(next[key], expected);
  }
});

test('add-interface project action keeps request and response contracts', async () => {
  const action = addInterface.fetchInterfaceProject(7);
  assert.equal(action.type, 'yapi/addInterface/FETCH_INTERFACE_PROJECT');
  assert.deepEqual(runtime.axiosCalls.at(-1), {
    method: 'get',
    url: '/api/project/get',
    configOrBody: { params: { id: 7 } },
    config: undefined
  });

  const response = {
    data: {
      errcode: 0,
      errmsg: '成功',
      data: { _id: 7, name: 'Typed project' }
    }
  };
  const next = addInterface.addInterfaceReducer(addInterface.initialState, {
    type: action.type,
    payload: response
  });
  assert.deepEqual(next.project, response.data.data);
  await action.payload;
});

test('follow actions preserve endpoints and resolved list state', async () => {
  const listAction = follow.getFollowList(9);
  assert.deepEqual(runtime.axiosCalls.at(-1), {
    method: 'get',
    url: '/api/follow/list',
    configOrBody: { params: { uid: 9 } },
    config: undefined
  });
  const rows = [{ _id: 2, name: 'API project' }];
  const next = follow.followReducer(follow.initialState, {
    type: listAction.type,
    payload: { data: { errcode: 0, errmsg: '成功', data: rows } }
  });
  assert.equal(next.data, rows);

  follow.addFollow({ projectid: 2 });
  assert.deepEqual(runtime.axiosCalls.at(-1), {
    method: 'post',
    url: '/api/follow/add',
    configOrBody: { projectid: 2 },
    config: undefined
  });
  follow.delFollow(2);
  assert.deepEqual(runtime.axiosCalls.at(-1), {
    method: 'post',
    url: '/api/follow/del',
    configOrBody: { projectid: 2 },
    config: undefined
  });
  await listAction.payload;
});
