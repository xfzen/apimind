import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';

import { createReduxRuntimeServer } from './support/vite-redux-runtime.mjs';

function resolved(type, data) {
  return { type, payload: { data: { errcode: 0, errmsg: '成功', data } } };
}

let runtime;
let inter;
let interfaceCol;

before(async () => {
  runtime = await createReduxRuntimeServer();
  [inter, interfaceCol] = await Promise.all([
    runtime.server.ssrLoadModule('/client/reducer/modules/interface.ts'),
    runtime.server.ssrLoadModule('/client/reducer/modules/interfaceCol.ts')
  ]);
});

after(async () => runtime?.restore());

test('interface reducer preserves every state transition', () => {
  const updated = inter.interfaceReducer(inter.initialState, inter.updateInterfaceData({ title: 'Changed' }));
  assert.equal(updated.curdata.title, 'Changed');
  assert.equal(inter.updateInterfaceData({ title: 'Changed' }).payload, true);
  assert.equal(inter.interfaceReducer(updated, inter.changeEditStatus(true)).editStatus, true);
  assert.equal(inter.interfaceReducer(updated, inter.initInterface()), inter.initialState);

  const current = { _id: 4, title: 'Current' };
  assert.equal(inter.interfaceReducer(updated, resolved(inter.actionTypes.FETCH_INTERFACE_DATA, current)).curdata, current);
  const menu = [{ _id: 1, name: 'Menu' }];
  assert.equal(inter.interfaceReducer(updated, resolved(inter.actionTypes.FETCH_INTERFACE_LIST_MENU, menu)).list, menu);
  const total = [{ _id: 2 }];
  const totalState = inter.interfaceReducer(updated, resolved(inter.actionTypes.FETCH_INTERFACE_LIST, { list: total, count: 8 }));
  assert.equal(totalState.totalTableList, total);
  assert.equal(totalState.totalCount, 8);
  const cats = [{ _id: 3 }];
  const catState = inter.interfaceReducer(updated, resolved(inter.actionTypes.FETCH_INTERFACE_CAT_LIST, { list: cats, count: 5 }));
  assert.equal(catState.catTableList, cats);
  assert.equal(catState.count, 5);
});

test('interface actions preserve direct async requests and list serialization', async () => {
  await inter.deleteInterfaceData(1);
  await inter.saveImportData({ project_id: 7 });
  await inter.deleteInterfaceCatData(2);
  await inter.fetchInterfaceData(3);
  await inter.fetchInterfaceListMenu(7);
  assert.deepEqual(runtime.axiosCalls.slice(-5).map(call => [call.method, call.url]), [
    ['post', '/api/interface/del'],
    ['post', '/api/interface/save'],
    ['post', '/api/interface/del_cat'],
    ['get', '/api/interface/get?id=3'],
    ['get', '/api/interface/list_menu?project_id=7']
  ]);

  const listAction = await inter.fetchInterfaceList({ project_id: 7, tag: ['a', 'b'] });
  assert.equal(listAction.type, inter.actionTypes.FETCH_INTERFACE_LIST);
  const listCall = runtime.axiosCalls.at(-1);
  assert.equal(listCall.url, '/api/interface/list');
  assert.equal(listCall.configOrBody.paramsSerializer({ tag: ['a', 'b'] }), 'tag=a&tag=b');

  const categoryAction = await inter.fetchInterfaceCatList({ project_id: 7 });
  assert.equal(categoryAction.payload instanceof Promise, true);
  assert.equal(runtime.axiosCalls.at(-1).url, '/api/interface/list_cat');
});

test('interface collection reducer preserves response and partial-state branches', () => {
  const cases = [{ _id: 1, name: 'Case' }];
  const environments = [{ _id: 2, name: 'Dev' }];
  const variables = [{ key: 'token' }];
  let state = interfaceCol.interfaceColReducer(interfaceCol.initialState, resolved(interfaceCol.actionTypes.FETCH_INTERFACE_COL_LIST, cases));
  assert.equal(state.interfaceColList, cases);
  state = interfaceCol.interfaceColReducer(state, resolved(interfaceCol.actionTypes.FETCH_CASE_DATA, cases[0]));
  assert.equal(state.currCase, cases[0]);
  state = interfaceCol.interfaceColReducer(state, resolved(interfaceCol.actionTypes.FETCH_CASE_LIST, cases));
  assert.equal(state.currCaseList, cases);
  state = interfaceCol.interfaceColReducer(state, resolved(interfaceCol.actionTypes.FETCH_VARIABLE_PARAMS_LIST, variables));
  assert.equal(state.variableParamsList, variables);
  state = interfaceCol.interfaceColReducer(state, resolved(interfaceCol.actionTypes.FETCH_CASE_ENV_LIST, environments));
  assert.equal(state.envList, environments);
  state = interfaceCol.interfaceColReducer(state, interfaceCol.setColData({ currColId: 9, isRender: true }));
  assert.equal(state.currColId, 9);
  assert.equal(state.isRender, true);
});

test('interface collection actions preserve exact endpoints', () => {
  interfaceCol.fetchInterfaceColList(7);
  interfaceCol.fetchCaseData(8);
  interfaceCol.fetchCaseList(9);
  interfaceCol.fetchCaseEnvList(10);
  interfaceCol.fetchVariableParamsList(11);
  assert.deepEqual(runtime.axiosCalls.slice(-5).map(call => call.url), [
    '/api/col/list?project_id=7',
    '/api/col/case?caseid=8',
    '/api/col/case_list/?col_id=9',
    '/api/col/case_env_list',
    '/api/col/case_list_by_var_params?col_id=11'
  ]);
  assert.deepEqual(runtime.axiosCalls.at(-2).configOrBody, { params: { col_id: 10 } });
});
