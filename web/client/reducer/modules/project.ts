import axios from 'axios';

import { htmlFilter } from '../../common';
import variable from '../../constants/variable';
import type { ApiResponse } from '../../types/api';
import type { LegacyReduxAction, UnknownRecord } from '../types/runtime';

export const actionTypes = {
  FETCH_PROJECT_LIST: 'yapi/project/FETCH_PROJECT_LIST', PROJECT_ADD: 'yapi/project/PROJECT_ADD',
  PROJECT_DEL: 'yapi/project/PROJECT_DEL', PROJECT_UPDATE: 'yapi/project/PROJECT_UPDATE',
  PROJECT_UPDATE_ENV: 'yapi/project/PROJECT_UPDATE_ENV', PROJECT_UPSET: 'yapi/project/PROJECT_UPSET',
  GET_CURR_PROJECT: 'yapi/project/GET_CURR_PROJECT', GET_PEOJECT_MEMBER: 'yapi/project/GET_PEOJECT_MEMBER',
  ADD_PROJECT_MEMBER: 'yapi/project/ADD_PROJECT_MEMBER', DEL_PROJECT_MEMBER: 'yapi/project/DEL_PROJECT_MEMBER',
  CHANGE_PROJECT_MEMBER: 'yapi/project/CHANGE_PROJECT_MEMBER', GET_TOKEN: 'yapi/project/GET_TOKEN',
  UPDATE_TOKEN: 'yapi/project/UPDATE_TOKEN', CHECK_PROJECT_NAME: 'yapi/project/CHECK_PROJECT_NAME',
  COPY_PROJECT_MSG: 'yapi/project/COPY_PROJECT_MSG', PROJECT_GET_ENV: 'yapi/project/PROJECT_GET_ENV',
  CHANGE_MEMBER_EMAIL_NOTICE: 'yapi/project/CHANGE_MEMBER_EMAIL_NOTICE',
  GET_SWAGGER_URL_DATA: 'yapi/project/GET_SWAGGER_URL_DATA'
} as const;

interface ProjectListResponse { list: UnknownRecord[]; total: number; userinfo: UnknownRecord }
interface ProjectEnvironment extends UnknownRecord { env: Array<UnknownRecord & { header: UnknownRecord[] }> }
export interface ProjectState {
  isUpdateModalShow: boolean;
  handleUpdateIndex: number;
  projectList: UnknownRecord[];
  projectMsg: UnknownRecord;
  userInfo: UnknownRecord;
  tableLoading: boolean;
  total: number;
  currPage: number;
  token: string;
  currProject: UnknownRecord;
  projectEnv: ProjectEnvironment;
  swaggerUrlData: string;
}
export const initialState: ProjectState = {
  isUpdateModalShow: false, handleUpdateIndex: -1, projectList: [], projectMsg: {}, userInfo: {},
  tableLoading: true, total: 0, currPage: 1, token: '', currProject: {},
  projectEnv: { env: [{ header: [] }] }, swaggerUrlData: ''
};

function responseData(action: LegacyReduxAction): unknown {
  return (action.payload as { data: ApiResponse<unknown> }).data.data;
}

export function projectReducer(state: ProjectState = initialState, action: LegacyReduxAction): ProjectState {
  switch (action.type) {
    case actionTypes.GET_CURR_PROJECT:
      return { ...state, currProject: responseData(action) as UnknownRecord };
    case actionTypes.FETCH_PROJECT_LIST: {
      const data = responseData(action) as ProjectListResponse;
      return { ...state, projectList: data.list, total: data.total, userInfo: data.userinfo };
    }
    case actionTypes.PROJECT_ADD:
    case actionTypes.PROJECT_DEL:
    case actionTypes.CHECK_PROJECT_NAME:
    case actionTypes.COPY_PROJECT_MSG:
      return state;
    case actionTypes.GET_TOKEN:
      return { ...state, token: responseData(action) as string };
    case actionTypes.PROJECT_GET_ENV:
      return { ...state, projectEnv: responseData(action) as ProjectEnvironment };
    case actionTypes.UPDATE_TOKEN:
      return { ...state, token: (responseData(action) as { token: string }).token };
    case actionTypes.GET_SWAGGER_URL_DATA:
      return { ...state, swaggerUrlData: responseData(action) as string };
    default:
      return state;
  }
}

function getAction<T>(type: string, url: string, params?: UnknownRecord) {
  return { type, payload: axios.get<ApiResponse<T>>(url, params === undefined ? undefined : { params }) };
}
function postAction(type: string, url: string, data: UnknownRecord) {
  return { type, payload: axios.post(url, data) };
}
export function fetchProjectList(id: string | number, pageNum?: number) {
  return getAction<ProjectListResponse>(actionTypes.FETCH_PROJECT_LIST, '/api/project/list', {
    group_id: id, page: pageNum || 1, limit: variable.PAGE_LIMIT
  });
}
export function copyProjectMsg(params: UnknownRecord) { return postAction(actionTypes.COPY_PROJECT_MSG, '/api/project/copy', params); }
export function addMember(param: UnknownRecord) { return postAction(actionTypes.ADD_PROJECT_MEMBER, '/api/project/add_member', param); }
export function delMember(param: UnknownRecord) { return postAction(actionTypes.DEL_PROJECT_MEMBER, '/api/project/del_member', param); }
export function changeMemberRole(param: UnknownRecord) { return postAction(actionTypes.CHANGE_PROJECT_MEMBER, '/api/project/change_member_role', param); }
export function changeMemberEmailNotice(param: UnknownRecord) {
  return postAction(actionTypes.CHANGE_MEMBER_EMAIL_NOTICE, '/api/project/change_member_email_notice', param);
}
export function getProjectMemberList(id: string | number) {
  return getAction<UnknownRecord[]>(actionTypes.GET_PEOJECT_MEMBER, '/api/project/get_member_list', { id });
}

export interface AddProjectInput extends UnknownRecord {
  name: string; prd_host: string; basepath: string; desc: string; group_id: string | number;
  group_name: string; protocol: string; icon: string; color: string; project_type: string;
}
export function addProject(data: AddProjectInput) {
  let { name } = data;
  const { prd_host, basepath, desc, group_id, group_name, protocol, icon, color, project_type } = data;
  name = htmlFilter(name);
  return postAction(actionTypes.PROJECT_ADD, '/api/project/add', {
    name, prd_host, protocol, basepath, desc, group_id, group_name, icon, color, project_type
  });
}

export interface UpdateProjectInput extends UnknownRecord {
  name: string; project_type: string; basepath: string; desc: string; _id: string | number;
  env: unknown; group_id: string | number; switch_notice: boolean; strice: boolean; is_json5: boolean; tag: unknown;
}
export function updateProject(data: UpdateProjectInput) {
  let { name } = data;
  const { project_type, basepath, desc, _id, env, group_id, switch_notice, strice, is_json5, tag } = data;
  name = htmlFilter(name);
  return postAction(actionTypes.PROJECT_UPDATE, '/api/project/up', {
    name, project_type, basepath, switch_notice, desc, id: _id, env, group_id, strice, is_json5, tag
  });
}
export function updateProjectScript(data: UnknownRecord) { return postAction(actionTypes.PROJECT_UPDATE, '/api/project/up', data); }
export function updateProjectMock(data: UnknownRecord) { return postAction(actionTypes.PROJECT_UPDATE, '/api/project/up', data); }
export function updateEnv(data: UnknownRecord & { _id: string | number; env: unknown }) {
  return postAction(actionTypes.PROJECT_UPDATE_ENV, '/api/project/up_env', { id: data._id, env: data.env });
}
export function getEnv(project_id: string | number) {
  return getAction<ProjectEnvironment>(actionTypes.PROJECT_GET_ENV, '/api/project/get_env', { project_id });
}
export function upsetProject(param: UnknownRecord) { return postAction(actionTypes.PROJECT_UPSET, '/api/project/upset', param); }
export function delProject(id: string | number) { return postAction(actionTypes.PROJECT_DEL, '/api/project/del', { id }); }
export async function getProject(id: string | number) {
  const result = await axios.get<ApiResponse<UnknownRecord>>('/api/project/get?id=' + id);
  return { type: actionTypes.GET_CURR_PROJECT, payload: result };
}
export async function getToken(project_id: string | number) {
  return getAction<string>(actionTypes.GET_TOKEN, '/api/project/token', { project_id });
}
export async function updateToken(project_id: string | number) {
  return getAction<{ token: string }>(actionTypes.UPDATE_TOKEN, '/api/project/update_token', { project_id });
}
export async function checkProjectName(name: string, group_id: string | number) {
  return getAction<unknown>(actionTypes.CHECK_PROJECT_NAME, '/api/project/check_project_name', { name, group_id });
}
export async function handleSwaggerUrlData(url: string) {
  return getAction<string>(actionTypes.GET_SWAGGER_URL_DATA, '/api/project/swagger_url?url=' + encodeURI(encodeURI(url)));
}
export default projectReducer;
