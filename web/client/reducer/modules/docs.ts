import axios from 'axios';

import type { ApiResponse } from '../../types/api';
import type { PromiseAction, ResolvedPromiseAction } from '../promiseTypes';
import type { UnknownRecord } from '../types/runtime';

export const actionTypes = {
  FETCH_DOCS: 'yapi/docs/FETCH_DOCS', FETCH_DOC: 'yapi/docs/FETCH_DOC',
  CREATE_DOC: 'yapi/docs/CREATE_DOC', UPDATE_DOC: 'yapi/docs/UPDATE_DOC',
  MOVE_DOC: 'yapi/docs/MOVE_DOC', DELETE_DOC: 'yapi/docs/DELETE_DOC',
  WORKSPACE_DOCS_PROJECT: 'yapi/docs/WORKSPACE_DOCS_PROJECT'
} as const;

export interface DocsState { list: UnknownRecord[]; current: UnknownRecord | null }
type DocsResolvedAction = ResolvedPromiseAction<ApiResponse<UnknownRecord[] | UnknownRecord>> & {
  type: (typeof actionTypes)[keyof typeof actionTypes];
};
interface DeleteDocAction { type: typeof actionTypes.DELETE_DOC }
export const initialState: DocsState = { list: [], current: null };

export function docsReducer(state: DocsState = initialState, action: DocsResolvedAction | DeleteDocAction): DocsState {
  switch (action.type) {
    case actionTypes.FETCH_DOCS:
      return { ...state, list: (action.payload.data.data || []) as UnknownRecord[] };
    case actionTypes.FETCH_DOC:
    case actionTypes.CREATE_DOC:
    case actionTypes.UPDATE_DOC:
    case actionTypes.MOVE_DOC:
      return { ...state, current: (action.payload.data.data || null) as UnknownRecord | null };
    case actionTypes.DELETE_DOC:
      return { ...state, current: null };
    default:
      return state;
  }
}

function getAction<T>(type: string, url: string, params?: UnknownRecord): PromiseAction<ApiResponse<T>> {
  return { type, payload: axios.get<ApiResponse<T>>(url, params === undefined ? undefined : { params }) };
}
function postAction<T>(type: string, url: string, data: UnknownRecord): PromiseAction<ApiResponse<T>> {
  return { type, payload: axios.post<ApiResponse<T>>(url, data) };
}
export function fetchDocs(workspaceId: string | number, projectId: string | number = 0) {
  return getAction<UnknownRecord[]>(actionTypes.FETCH_DOCS, '/api/docs/list', { workspace_id: workspaceId, project_id: projectId });
}
export function ensureWorkspaceDocsProject(workspaceId: string | number) {
  return getAction<UnknownRecord>(actionTypes.WORKSPACE_DOCS_PROJECT, '/api/docs/workspace_project', { workspace_id: workspaceId });
}
export function fetchDoc(id: string | number) {
  return getAction<UnknownRecord>(actionTypes.FETCH_DOC, '/api/docs/get', { id });
}
export function createDoc(payload: UnknownRecord) {
  return postAction<UnknownRecord>(actionTypes.CREATE_DOC, '/api/docs/create', payload);
}
export function updateDoc(payload: UnknownRecord) {
  return postAction<UnknownRecord>(actionTypes.UPDATE_DOC, '/api/docs/update', payload);
}
export function moveDoc(payload: UnknownRecord) {
  return postAction<UnknownRecord>(actionTypes.MOVE_DOC, '/api/docs/move', payload);
}
export function deleteDoc(id: string | number) {
  return postAction<UnknownRecord>(actionTypes.DELETE_DOC, '/api/docs/delete', { id });
}
export default docsReducer;
