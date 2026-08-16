import axios from 'axios';

import type { ApiResponse } from '../../types/api';
import type { PromiseAction, ResolvedPromiseAction } from '../promiseTypes';
import type { UnknownRecord } from '../types/runtime';

export const actionTypes = {
  FETCH_TEMPLATE_PROJECTS: 'yapi/template/FETCH_TEMPLATE_PROJECTS',
  FETCH_TEMPLATES: 'yapi/template/FETCH_TEMPLATES',
  GET_TEMPLATE: 'yapi/template/GET_TEMPLATE',
  UPDATE_TEMPLATE: 'yapi/template/UPDATE_TEMPLATE'
} as const;
export interface TemplateItem extends UnknownRecord { key: string }
export interface TemplateState { projects: UnknownRecord[]; list: TemplateItem[]; current: TemplateItem | null }
type TemplateAction = ResolvedPromiseAction<ApiResponse<UnknownRecord[] | TemplateItem>> & {
  type: (typeof actionTypes)[keyof typeof actionTypes];
};
export const initialState: TemplateState = { projects: [], list: [], current: null };

export function templateReducer(state: TemplateState = initialState, action: TemplateAction): TemplateState {
  switch (action.type) {
    case actionTypes.FETCH_TEMPLATE_PROJECTS:
      return { ...state, projects: (action.payload.data.data || []) as UnknownRecord[] };
    case actionTypes.FETCH_TEMPLATES:
      return { ...state, list: (action.payload.data.data || []) as TemplateItem[] };
    case actionTypes.GET_TEMPLATE:
      return { ...state, current: (action.payload.data.data || null) as TemplateItem | null };
    case actionTypes.UPDATE_TEMPLATE: {
      const current = (action.payload.data.data || null) as TemplateItem | null;
      return { ...state, current, list: current ? state.list.map(item => item.key === current.key ? { ...item, ...current } : item) : state.list };
    }
    default:
      return state;
  }
}
function getAction<T>(type: string, url: string, params?: UnknownRecord): PromiseAction<ApiResponse<T>> {
  return { type, payload: axios.get<ApiResponse<T>>(url, params === undefined ? undefined : { params }) };
}
export function fetchTemplateProjects() {
  return getAction<UnknownRecord[]>(actionTypes.FETCH_TEMPLATE_PROJECTS, '/api/templates/projects');
}
export function fetchTemplates(params: UnknownRecord) {
  return getAction<TemplateItem[]>(actionTypes.FETCH_TEMPLATES, '/api/templates/list', params);
}
export function searchTemplates(params: UnknownRecord) {
  return getAction<TemplateItem[]>(actionTypes.FETCH_TEMPLATES, '/api/templates/search', params);
}
export function getTemplate(key: string) {
  return getAction<TemplateItem>(actionTypes.GET_TEMPLATE, '/api/templates/get', { key });
}
export function updateTemplate(data: TemplateItem): PromiseAction<ApiResponse<TemplateItem>> {
  return { type: actionTypes.UPDATE_TEMPLATE, payload: axios.post<ApiResponse<TemplateItem>>('/api/templates/update', data) };
}
export default templateReducer;
