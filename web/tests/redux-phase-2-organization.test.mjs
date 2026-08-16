import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';

import { createReduxRuntimeServer } from './support/vite-redux-runtime.mjs';

function resolved(type, data) {
  return { type, payload: { data: { errcode: 0, errmsg: '成功', data } } };
}

let runtime;
let group;
let project;

before(async () => {
  runtime = await createReduxRuntimeServer();
  [group, project] = await Promise.all([
    runtime.server.ssrLoadModule('/client/reducer/modules/group.ts'),
    runtime.server.ssrLoadModule('/client/reducer/modules/project.ts')
  ]);
});
after(async () => runtime?.restore());

test('group reducer preserves list, current, member, message, and sync update behavior', () => {
  const groups = [{ _id: 1, group_name: 'One' }];
  let state = group.groupReducer(group.initialState, resolved(group.actionTypes.FETCH_GROUP_LIST, groups));
  assert.equal(state.groupList, groups);
  const replacement = [{ _id: 2, group_name: 'Two' }];
  state = group.groupReducer(state, group.updateGroupList(replacement));
  assert.equal(state.groupList, replacement);
  const current = { _id: 2, group_name: 'Two', group_desc: '', custom_field1: { name: '', enable: false } };
  state = group.groupReducer(state, resolved(group.actionTypes.SET_CURR_GROUP, current));
  assert.equal(state.currGroup, current);
  const members = [{ uid: 3, role: 'dev' }];
  state = group.groupReducer(state, resolved(group.actionTypes.FETCH_GROUP_MEMBER, members));
  assert.equal(state.member, members);
  const updated = group.groupReducer(state, resolved(group.actionTypes.FETCH_GROUP_MSG, {
    role: 'owner', group_name: 'G', group_desc: '', custom_field1: { name: 'Tier', enable: true }
  }));
  assert.equal(updated.role, 'owner');
  assert.deepEqual(updated.field, { name: 'Tier', enable: true });
});

test('group action creators preserve exact methods and endpoints', () => {
  group.fetchGroupMsg(1);
  group.addMember({ id: 1 });
  group.delMember({ id: 2 });
  group.changeMemberRole({ id: 3 });
  group.changeGroupMsg({ id: 4 });
  group.deleteGroup({ id: 5 });
  group.fetchGroupMemberList(6);
  group.fetchGroupList();
  group.setCurrGroup({ _id: 7 });
  assert.deepEqual(runtime.axiosCalls.slice(-9).map(call => [call.method, call.url]), [
    ['get', '/api/group/get'], ['post', '/api/group/add_member'], ['post', '/api/group/del_member'],
    ['post', '/api/group/change_member_role'], ['post', '/api/group/up'], ['post', '/api/group/del'],
    ['get', '/api/group/get_member_list'], ['get', '/api/group/list'], ['get', '/api/group/get']
  ]);
});

test('project reducer preserves all handled response transitions and legacy spelling', () => {
  assert.equal(project.actionTypes.GET_PEOJECT_MEMBER, 'yapi/project/GET_PEOJECT_MEMBER');
  let state = project.projectReducer(project.initialState, resolved(project.actionTypes.GET_CURR_PROJECT, { _id: 1 }));
  assert.equal(state.currProject._id, 1);
  state = project.projectReducer(state, resolved(project.actionTypes.FETCH_PROJECT_LIST, {
    list: [{ _id: 2 }], total: 6, userinfo: { uid: 9 }
  }));
  assert.equal(state.total, 6);
  assert.equal(state.userInfo.uid, 9);
  state = project.projectReducer(state, resolved(project.actionTypes.GET_TOKEN, 'token-a'));
  assert.equal(state.token, 'token-a');
  state = project.projectReducer(state, resolved(project.actionTypes.PROJECT_GET_ENV, { env: [{ header: [] }] }));
  assert.equal(state.projectEnv.env.length, 1);
  state = project.projectReducer(state, resolved(project.actionTypes.UPDATE_TOKEN, { token: 'token-b' }));
  assert.equal(state.token, 'token-b');
  state = project.projectReducer(state, resolved(project.actionTypes.GET_SWAGGER_URL_DATA, 'swagger'));
  assert.equal(state.swaggerUrlData, 'swagger');
  for (const type of [project.actionTypes.PROJECT_ADD, project.actionTypes.PROJECT_DEL, project.actionTypes.CHECK_PROJECT_NAME, project.actionTypes.COPY_PROJECT_MSG]) {
    assert.equal(project.projectReducer(state, { type }), state);
  }
});

test('project actions preserve legacy payloads, spellings, defaults, and encoding', async () => {
  project.fetchProjectList(3, 0);
  assert.deepEqual(runtime.axiosCalls.at(-1).configOrBody.params, { group_id: 3, page: 1, limit: 10 });
  project.copyProjectMsg({ id: 1 });
  project.addMember({ id: 2 });
  project.delMember({ id: 3 });
  project.changeMemberRole({ id: 4 });
  project.changeMemberEmailNotice({ id: 5 });
  project.getProjectMemberList(6);
  project.addProject({ name: '<b>Name</b>', prd_host: '', basepath: '/', desc: '', group_id: 3, group_name: 'G', protocol: 'http', icon: 'code-o', color: 'blue', project_type: 'private' });
  assert.equal(runtime.axiosCalls.at(-1).configOrBody.name, 'Name');
  project.updateProject({ name: '<i>New</i>', project_type: 'private', basepath: '/', desc: '', _id: 1, env: [], group_id: 3, switch_notice: true, strice: false, is_json5: true, tag: ['x'] });
  assert.equal(runtime.axiosCalls.at(-1).configOrBody.strice, false);
  project.updateProjectScript({ id: 1 });
  project.updateProjectMock({ id: 1 });
  project.updateEnv({ _id: 1, env: [] });
  project.getEnv(1);
  project.upsetProject({ id: 1 });
  project.delProject(1);
  await project.getProject(1);
  assert.equal(runtime.axiosCalls.at(-1).url, '/api/project/get?id=1');
  const tokenAction = await project.getToken(1);
  assert.equal(tokenAction.payload instanceof Promise, true);
  await project.updateToken(1);
  await project.checkProjectName('Name', 3);
  await project.handleSwaggerUrlData('https://example.invalid/a b?x=1');
  assert.equal(runtime.axiosCalls.at(-1).url, '/api/project/swagger_url?url=' + encodeURI(encodeURI('https://example.invalid/a b?x=1')));
});
