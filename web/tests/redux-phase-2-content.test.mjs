import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';

import { createReduxRuntimeServer } from './support/vite-redux-runtime.mjs';

function resolved(type, data) {
  return {
    type,
    payload: { data: { errcode: 0, errmsg: '成功', data } }
  };
}

let runtime;
let docs;
let template;
let news;
let mockCol;

before(async () => {
  runtime = await createReduxRuntimeServer();
  [docs, template, news, mockCol] = await Promise.all([
    runtime.server.ssrLoadModule('/client/reducer/modules/docs.ts'),
    runtime.server.ssrLoadModule('/client/reducer/modules/template.ts'),
    runtime.server.ssrLoadModule('/client/reducer/modules/news.ts'),
    runtime.server.ssrLoadModule('/client/reducer/modules/mockCol.ts')
  ]);
});

after(async () => {
  await runtime?.restore();
});

test('docs reducer retains list, current, and deletion transitions', () => {
  const rows = [{ _id: 1, title: 'Overview' }];
  const listed = docs.docsReducer(
    docs.initialState,
    resolved(docs.actionTypes.FETCH_DOCS, rows)
  );
  assert.equal(listed.list, rows);

  const current = { _id: 1, title: 'Updated' };
  for (const type of [
    docs.actionTypes.FETCH_DOC,
    docs.actionTypes.CREATE_DOC,
    docs.actionTypes.UPDATE_DOC,
    docs.actionTypes.MOVE_DOC
  ]) {
    assert.equal(docs.docsReducer(listed, resolved(type, current)).current, current);
  }
  assert.equal(
    docs.docsReducer({ ...listed, current }, { type: docs.actionTypes.DELETE_DOC }).current,
    null
  );
});

test('docs action creators preserve methods, URLs, params, and bodies', () => {
  docs.fetchDocs(5, 7);
  docs.ensureWorkspaceDocsProject(5);
  docs.fetchDoc(9);
  docs.createDoc({ title: 'New' });
  docs.updateDoc({ _id: 9, title: 'Changed' });
  docs.moveDoc({ _id: 9, parent_id: 2 });
  docs.deleteDoc(9);

  assert.deepEqual(runtime.axiosCalls.slice(-7), [
    { method: 'get', url: '/api/docs/list', configOrBody: { params: { workspace_id: 5, project_id: 7 } }, config: undefined },
    { method: 'get', url: '/api/docs/workspace_project', configOrBody: { params: { workspace_id: 5 } }, config: undefined },
    { method: 'get', url: '/api/docs/get', configOrBody: { params: { id: 9 } }, config: undefined },
    { method: 'post', url: '/api/docs/create', configOrBody: { title: 'New' }, config: undefined },
    { method: 'post', url: '/api/docs/update', configOrBody: { _id: 9, title: 'Changed' }, config: undefined },
    { method: 'post', url: '/api/docs/move', configOrBody: { _id: 9, parent_id: 2 }, config: undefined },
    { method: 'post', url: '/api/docs/delete', configOrBody: { id: 9 }, config: undefined }
  ]);
});

test('template update merges the matching list entry and preserves other entries', () => {
  const state = {
    projects: [],
    list: [{ key: 'base', name: 'Old' }, { key: 'other', name: 'Other' }],
    current: null
  };
  const current = { key: 'base', name: 'Updated', description: 'Typed' };
  const next = template.templateReducer(
    state,
    resolved(template.actionTypes.UPDATE_TEMPLATE, current)
  );

  assert.equal(next.current, current);
  assert.deepEqual(next.list, [current, { key: 'other', name: 'Other' }]);

  template.fetchTemplateProjects();
  template.fetchTemplates({ project_id: 7 });
  template.searchTemplates({ keyword: 'auth' });
  template.getTemplate('base');
  template.updateTemplate(current);
  assert.deepEqual(runtime.axiosCalls.slice(-5).map(call => [call.method, call.url]), [
    ['get', '/api/templates/projects'],
    ['get', '/api/templates/list'],
    ['get', '/api/templates/search'],
    ['get', '/api/templates/get'],
    ['post', '/api/templates/update']
  ]);
});

test('news reducer preserves in-place sorting, append, and page mutation', () => {
  const initialList = [{ add_time: 1, title: 'old' }];
  const state = { newsData: { list: initialList, total: 1 }, curpage: 1 };
  const next = news.newsReducer(
    state,
    resolved(news.actionTypes.FETCH_MORE_NEWS, {
      list: [{ add_time: 3, title: 'new' }],
      total: 2
    })
  );

  assert.equal(next.newsData.list, initialList);
  assert.deepEqual(initialList.map(item => item.add_time), [3, 1]);
  assert.equal(state.curpage, 2);
  assert.equal(next.curpage, 2);
});

test('news actions preserve default limit and auxiliary endpoints', () => {
  news.fetchNewsData(3, 'group', 2, 0, 'all');
  assert.deepEqual(runtime.axiosCalls.at(-1), {
    method: 'get',
    url: '/api/log/list',
    configOrBody: {
      params: { typeid: 3, type: 'group', page: 2, limit: 10, selectValue: 'all' }
    },
    config: undefined
  });
  news.getMockUrl(8);
  assert.equal(runtime.axiosCalls.at(-1).url, '/api/project/get');
  news.fetchUpdateLogData({ project_id: 8 });
  assert.equal(runtime.axiosCalls.at(-1).url, '/api/log/list_by_update');
});

test('mock collection keeps its awaited action and reducer payload shape', async () => {
  const action = await mockCol.fetchMockCol(12);
  assert.equal(action.type, 'yapi/mockCol/FETCH_MOCK_COL');
  assert.deepEqual(runtime.axiosCalls.at(-1), {
    method: 'get',
    url: '/api/plugin/advmock/case/list?interface_id=12',
    configOrBody: undefined,
    config: undefined
  });
  const next = mockCol.mockColReducer(mockCol.initialState, {
    type: action.type,
    payload: { data: [{ _id: 4, name: 'case' }] }
  });
  assert.deepEqual(next.list, [{ _id: 4, name: 'case' }]);
});
