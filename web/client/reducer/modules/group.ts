import axios from 'axios';

import type { ApiResponse } from '../../types/api';
import type { PromiseAction, ResolvedPromiseAction } from '../promiseTypes';
import type { UnknownRecord } from '../types/runtime';

export const actionTypes = {
  FETCH_GROUP_LIST: 'yapi/group/FETCH_GROUP_LIST', SET_CURR_GROUP: 'yapi/group/SET_CURR_GROUP',
  FETCH_GROUP_MEMBER: 'yapi/group/FETCH_GROUP_MEMBER', FETCH_GROUP_MSG: 'yapi/group/FETCH_GROUP_MSG',
  ADD_GROUP_MEMBER: 'yapi/group/ADD_GROUP_MEMBER', DEL_GROUP_MEMBER: 'yapi/group/DEL_GROUP_MEMBER',
  CHANGE_GROUP_MEMBER: 'yapi/group/CHANGE_GROUP_MEMBER', CHANGE_GROUP_MESSAGE: 'yapi/group/CHANGE_GROUP_MESSAGE',
  UPDATE_GROUP_LIST: 'yapi/group/UPDATE_GROUP_LIST', DEL_GROUP: 'yapi/group/DEL_GROUP'
} as const;

export interface GroupCustomField { name: string; enable: boolean }
export interface GroupRecord extends UnknownRecord {
  _id?: string | number;
  group_name: string;
  group_desc: string;
  custom_field1: GroupCustomField;
}
export interface GroupState {
  groupList: GroupRecord[];
  currGroup: GroupRecord;
  field: GroupCustomField;
  member: UnknownRecord[];
  role: string;
}
type GroupResponseAction = ResolvedPromiseAction<ApiResponse<GroupRecord | GroupRecord[] | UnknownRecord[]>> & {
  type: typeof actionTypes.FETCH_GROUP_LIST | typeof actionTypes.SET_CURR_GROUP |
    typeof actionTypes.FETCH_GROUP_MEMBER | typeof actionTypes.FETCH_GROUP_MSG;
};
interface UpdateGroupListAction { type: typeof actionTypes.UPDATE_GROUP_LIST; payload: GroupRecord[] }
type GroupAction = GroupResponseAction | UpdateGroupListAction;

export const initialState: GroupState = {
  groupList: [],
  currGroup: { group_name: '', group_desc: '', custom_field1: { name: '', enable: false } },
  field: { name: '', enable: false }, member: [], role: ''
};

export function groupReducer(state: GroupState = initialState, action: GroupAction): GroupState {
  switch (action.type) {
    case actionTypes.FETCH_GROUP_LIST:
      return { ...state, groupList: action.payload.data.data as GroupRecord[] };
    case actionTypes.UPDATE_GROUP_LIST:
      return { ...state, groupList: action.payload };
    case actionTypes.SET_CURR_GROUP:
      return { ...state, currGroup: action.payload.data.data as GroupRecord };
    case actionTypes.FETCH_GROUP_MEMBER:
      return { ...state, member: action.payload.data.data as UnknownRecord[] };
    case actionTypes.FETCH_GROUP_MSG: {
      console.log(action.payload);
      const group = action.payload.data.data as GroupRecord & { role: string };
      return {
        ...state, role: group.role, currGroup: group,
        field: { name: group.custom_field1.name, enable: group.custom_field1.enable }
      };
    }
    default:
      return state;
  }
}

function getAction<T>(type: string, url: string, params?: UnknownRecord): PromiseAction<ApiResponse<T>> {
  return { type, payload: axios.get<ApiResponse<T>>(url, params === undefined ? undefined : { params }) };
}
function postAction(type: string, url: string, param: UnknownRecord) {
  return { type, payload: axios.post(url, param) };
}
export function fetchGroupMsg(id: string | number) {
  return getAction<GroupRecord & { role: string }>(actionTypes.FETCH_GROUP_MSG, '/api/group/get', { id });
}
export function addMember(param: UnknownRecord) { return postAction(actionTypes.ADD_GROUP_MEMBER, '/api/group/add_member', param); }
export function delMember(param: UnknownRecord) { return postAction(actionTypes.DEL_GROUP_MEMBER, '/api/group/del_member', param); }
export function changeMemberRole(param: UnknownRecord) { return postAction(actionTypes.CHANGE_GROUP_MEMBER, '/api/group/change_member_role', param); }
export function changeGroupMsg(param: UnknownRecord) { return postAction(actionTypes.CHANGE_GROUP_MESSAGE, '/api/group/up', param); }
export function updateGroupList(param: GroupRecord[]): UpdateGroupListAction {
  return { type: actionTypes.UPDATE_GROUP_LIST, payload: param };
}
export function deleteGroup(param: UnknownRecord) { return postAction(actionTypes.DEL_GROUP, '/api/group/del', param); }
export function fetchGroupMemberList(id: string | number) {
  return getAction<UnknownRecord[]>(actionTypes.FETCH_GROUP_MEMBER, '/api/group/get_member_list', { id });
}
export function fetchGroupList() {
  return getAction<GroupRecord[]>(actionTypes.FETCH_GROUP_LIST, '/api/group/list');
}
export function setCurrGroup(group: Pick<GroupRecord, '_id'>) {
  return getAction<GroupRecord>(actionTypes.SET_CURR_GROUP, '/api/group/get', { id: group._id });
}
export default groupReducer;
