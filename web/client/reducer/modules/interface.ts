import axios from 'axios';
import qs from 'qs';

import type { AxiosResponse } from 'axios';
import type { ApiResponse } from '../../types/api';
import type { ResolvedPromiseAction } from '../promiseTypes';
import type { UnknownRecord } from '../types/runtime';

export const actionTypes = {
  INIT_INTERFACE_DATA: 'yapi/interface/INIT_INTERFACE_DATA',
  FETCH_INTERFACE_DATA: 'yapi/interface/FETCH_INTERFACE_DATA',
  FETCH_INTERFACE_LIST_MENU: 'yapi/interface/FETCH_INTERFACE_LIST_MENU',
  DELETE_INTERFACE_DATA: 'yapi/interface/DELETE_INTERFACE_DATA',
  DELETE_INTERFACE_CAT_DATA: 'yapi/interface/DELETE_INTERFACE_CAT_DATA',
  UPDATE_INTERFACE_DATA: 'yapi/interface/UPDATE_INTERFACE_DATA',
  CHANGE_EDIT_STATUS: 'yapi/interface/CHANGE_EDIT_STATUS',
  FETCH_INTERFACE_LIST: 'yapi/interface/FETCH_INTERFACE_LIST',
  SAVE_IMPORT_DATA: 'yapi/interface/SAVE_IMPORT_DATA',
  FETCH_INTERFACE_CAT_LIST: 'yapi/interface/FETCH_INTERFACE_CAT_LIST'
} as const;

interface InterfaceListResponse { list: UnknownRecord[]; count: number }
export interface InterfaceState {
  curdata: UnknownRecord;
  list: UnknownRecord[];
  editStatus: boolean;
  totalTableList: UnknownRecord[];
  catTableList: UnknownRecord[];
  count: number;
  totalCount: number;
}
interface InitAction { type: typeof actionTypes.INIT_INTERFACE_DATA }
interface UpdateAction { type: typeof actionTypes.UPDATE_INTERFACE_DATA; updata: UnknownRecord; payload: true }
interface EditAction { type: typeof actionTypes.CHANGE_EDIT_STATUS; status: boolean }
type DataAction = ResolvedPromiseAction<ApiResponse<UnknownRecord>> & { type: typeof actionTypes.FETCH_INTERFACE_DATA };
type MenuAction = ResolvedPromiseAction<ApiResponse<UnknownRecord[]>> & { type: typeof actionTypes.FETCH_INTERFACE_LIST_MENU };
type ListAction = ResolvedPromiseAction<ApiResponse<InterfaceListResponse>> & {
  type: typeof actionTypes.FETCH_INTERFACE_LIST | typeof actionTypes.FETCH_INTERFACE_CAT_LIST;
};
type InterfaceAction = InitAction | UpdateAction | EditAction | DataAction | MenuAction | ListAction;

export const initialState: InterfaceState = {
  curdata: {}, list: [], editStatus: false, totalTableList: [], catTableList: [], count: 0, totalCount: 0
};

export function interfaceReducer(state: InterfaceState = initialState, action: InterfaceAction): InterfaceState {
  switch (action.type) {
    case actionTypes.INIT_INTERFACE_DATA:
      return initialState;
    case actionTypes.UPDATE_INTERFACE_DATA:
      return { ...state, curdata: Object.assign({}, state.curdata, action.updata) };
    case actionTypes.FETCH_INTERFACE_DATA:
      return { ...state, curdata: action.payload.data.data as UnknownRecord };
    case actionTypes.FETCH_INTERFACE_LIST_MENU:
      return { ...state, list: action.payload.data.data as UnknownRecord[] };
    case actionTypes.CHANGE_EDIT_STATUS:
      return { ...state, editStatus: action.status };
    case actionTypes.FETCH_INTERFACE_LIST: {
      const data = action.payload.data.data as InterfaceListResponse;
      return { ...state, totalTableList: data.list, totalCount: data.count };
    }
    case actionTypes.FETCH_INTERFACE_CAT_LIST: {
      const data = action.payload.data.data as InterfaceListResponse;
      return { ...state, catTableList: data.list, count: data.count };
    }
    default:
      return state;
  }
}

export function changeEditStatus(status: boolean): EditAction {
  return { type: actionTypes.CHANGE_EDIT_STATUS, status };
}
export function initInterface(): InitAction { return { type: actionTypes.INIT_INTERFACE_DATA }; }
export function updateInterfaceData(updata: UnknownRecord): UpdateAction {
  return { type: actionTypes.UPDATE_INTERFACE_DATA, updata, payload: true };
}
export async function deleteInterfaceData(id: string | number) {
  const result = await axios.post('/api/interface/del', { id });
  return { type: actionTypes.DELETE_INTERFACE_DATA, payload: result };
}
export async function saveImportData(data: UnknownRecord) {
  const result = await axios.post('/api/interface/save', data);
  return { type: actionTypes.SAVE_IMPORT_DATA, payload: result };
}
export async function deleteInterfaceCatData(id: string | number) {
  const result = await axios.post('/api/interface/del_cat', { catid: id });
  return { type: actionTypes.DELETE_INTERFACE_CAT_DATA, payload: result };
}
export async function fetchInterfaceData(interfaceId: string | number) {
  const result = await axios.get<ApiResponse<UnknownRecord>>('/api/interface/get?id=' + interfaceId);
  return { type: actionTypes.FETCH_INTERFACE_DATA, payload: result };
}
export async function fetchInterfaceListMenu(projectId: string | number) {
  const result = await axios.get<ApiResponse<UnknownRecord[]>>('/api/interface/list_menu?project_id=' + projectId);
  return { type: actionTypes.FETCH_INTERFACE_LIST_MENU, payload: result };
}
function listRequest(params: UnknownRecord): Promise<AxiosResponse<ApiResponse<InterfaceListResponse>>> {
  return axios.get<ApiResponse<InterfaceListResponse>>('/api/interface/list', {
    params,
    paramsSerializer: value => qs.stringify(value, { indices: false })
  });
}
export async function fetchInterfaceList(params: UnknownRecord) {
  const result = await listRequest(params);
  return { type: actionTypes.FETCH_INTERFACE_LIST, payload: result };
}
export async function fetchInterfaceCatList(params: UnknownRecord) {
  const result = axios.get<ApiResponse<InterfaceListResponse>>('/api/interface/list_cat', {
    params,
    paramsSerializer: value => qs.stringify(value, { indices: false })
  });
  return { type: actionTypes.FETCH_INTERFACE_CAT_LIST, payload: result };
}
export default interfaceReducer;
