import axios from 'axios';

import type { ApiResponse } from '../../types/api';
import type { PromiseAction, ResolvedPromiseAction } from '../promiseTypes';
import type { UnknownRecord } from '../types/runtime';

export const actionTypes = {
  FETCH_INTERFACE_COL_LIST: 'yapi/interfaceCol/FETCH_INTERFACE_COL_LIST',
  FETCH_CASE_DATA: 'yapi/interfaceCol/FETCH_CASE_DATA',
  FETCH_CASE_LIST: 'yapi/interfaceCol/FETCH_CASE_LIST',
  SET_COL_DATA: 'yapi/interfaceCol/SET_COL_DATA',
  FETCH_VARIABLE_PARAMS_LIST: 'yapi/interfaceCol/FETCH_VARIABLE_PARAMS_LIST',
  FETCH_CASE_ENV_LIST: 'yapi/interfaceCol/FETCH_CASE_ENV_LIST'
} as const;

export interface InterfaceCollection extends UnknownRecord {
  _id: number;
  name: string;
  uid: number;
  project_id: number;
  desc: string;
  add_time: number;
  up_time: number;
  caseList: UnknownRecord[];
}
export interface InterfaceColState {
  interfaceColList: InterfaceCollection[];
  isShowCol: boolean;
  isRender: boolean;
  currColId: number;
  currCaseId: number;
  currCase: UnknownRecord;
  currCaseList: UnknownRecord[];
  variableParamsList: UnknownRecord[];
  envList: UnknownRecord[];
}
type ResponseAction = ResolvedPromiseAction<ApiResponse<UnknownRecord | UnknownRecord[]>> & {
  type: Exclude<(typeof actionTypes)[keyof typeof actionTypes], typeof actionTypes.SET_COL_DATA>;
};
interface SetAction { type: typeof actionTypes.SET_COL_DATA; payload: Partial<InterfaceColState> }
type InterfaceColAction = ResponseAction | SetAction;

export const initialState: InterfaceColState = {
  interfaceColList: [{
    _id: 0, name: '', uid: 0, project_id: 0, desc: '', add_time: 0, up_time: 0, caseList: [{}]
  }],
  isShowCol: true,
  isRender: false,
  currColId: 0,
  currCaseId: 0,
  currCase: {},
  currCaseList: [],
  variableParamsList: [],
  envList: []
};

export function interfaceColReducer(
  state: InterfaceColState = initialState,
  action: InterfaceColAction
): InterfaceColState {
  switch (action.type) {
    case actionTypes.FETCH_INTERFACE_COL_LIST:
      return { ...state, interfaceColList: action.payload.data.data as InterfaceCollection[] };
    case actionTypes.FETCH_CASE_DATA:
      return { ...state, currCase: action.payload.data.data as UnknownRecord };
    case actionTypes.FETCH_CASE_LIST:
      return { ...state, currCaseList: action.payload.data.data as UnknownRecord[] };
    case actionTypes.FETCH_VARIABLE_PARAMS_LIST:
      return { ...state, variableParamsList: action.payload.data.data as UnknownRecord[] };
    case actionTypes.SET_COL_DATA:
      return { ...state, ...action.payload };
    case actionTypes.FETCH_CASE_ENV_LIST:
      return { ...state, envList: action.payload.data.data as UnknownRecord[] };
    default:
      return state;
  }
}

function getAction<T>(type: string, url: string, params?: UnknownRecord): PromiseAction<ApiResponse<T>> {
  return { type, payload: axios.get<ApiResponse<T>>(url, params === undefined ? undefined : { params }) };
}
export function fetchInterfaceColList(projectId: string | number) {
  return getAction<InterfaceCollection[]>(actionTypes.FETCH_INTERFACE_COL_LIST, '/api/col/list?project_id=' + projectId);
}
export function fetchCaseData(caseId: string | number) {
  return getAction<UnknownRecord>(actionTypes.FETCH_CASE_DATA, '/api/col/case?caseid=' + caseId);
}
export function fetchCaseList(colId: string | number) {
  return getAction<UnknownRecord[]>(actionTypes.FETCH_CASE_LIST, '/api/col/case_list/?col_id=' + colId);
}
export function fetchCaseEnvList(col_id: string | number) {
  return getAction<UnknownRecord[]>(actionTypes.FETCH_CASE_ENV_LIST, '/api/col/case_env_list', { col_id });
}
export function fetchVariableParamsList(colId: string | number) {
  return getAction<UnknownRecord[]>(actionTypes.FETCH_VARIABLE_PARAMS_LIST, '/api/col/case_list_by_var_params?col_id=' + colId);
}
export function setColData(data: Partial<InterfaceColState>): SetAction {
  return { type: actionTypes.SET_COL_DATA, payload: data };
}
export default interfaceColReducer;
