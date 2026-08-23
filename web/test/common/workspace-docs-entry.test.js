import test from 'ava';
import { openWorkspaceDocsProject } from '../../client/containers/Group/ProjectList/workspaceDocsEntry.ts';

const docsProject = {
  _id: 33,
  name: '工作区文档',
  group_id: 11,
  desc: '当前工作区的文档项目',
  kind: 'docs'
};

test('openWorkspaceDocsProject refreshes and navigates after ensure succeeds', async t => {
  const calls = [];
  const response = await openWorkspaceDocsProject({
    workspaceId: 11,
    page: 2,
    ensure: async workspaceId => {
      calls.push(['ensure', workspaceId]);
      return {
        type: 'yapi/docs/WORKSPACE_DOCS_PROJECT',
        payload: { data: { errcode: 0, errmsg: '成功！', data: docsProject } }
      };
    },
    refresh: async (workspaceId, page) => calls.push(['refresh', workspaceId, page]),
    navigate: path => calls.push(['navigate', path])
  });

  t.deepEqual(response.data, docsProject);
  t.deepEqual(calls, [
    ['ensure', 11],
    ['refresh', 11, 2],
    ['navigate', '/project/33/interface/api']
  ]);
});

test('openWorkspaceDocsProject returns API errors without refresh or navigation', async t => {
  const calls = [];
  const response = await openWorkspaceDocsProject({
    workspaceId: 11,
    page: 1,
    ensure: async workspaceId => {
      calls.push(['ensure', workspaceId]);
      return {
        type: 'yapi/docs/WORKSPACE_DOCS_PROJECT',
        payload: { data: { errcode: 403, errmsg: '没有权限', data: null } }
      };
    },
    refresh: async (...args) => calls.push(['refresh', ...args]),
    navigate: path => calls.push(['navigate', path])
  });

  t.is(response.errcode, 403);
  t.deepEqual(calls, [['ensure', 11]]);
});
