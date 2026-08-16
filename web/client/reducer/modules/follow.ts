import axios from 'axios';

import type { ApiResponse } from '../../types/api';
import type { PromiseAction, ResolvedPromiseAction } from '../promiseTypes';
import type { UnknownRecord } from '../types/runtime';

export const actionTypes = {
  GET_FOLLOW_LIST: 'yapi/follow/GET_FOLLOW_LIST',
  DEL_FOLLOW: 'yapi/follow/DEL_FOLLOW',
  ADD_FOLLOW: 'yapi/follow/ADD_FOLLOW'
} as const;

export interface FollowState {
  data: UnknownRecord[];
}

type FollowListAction = ResolvedPromiseAction<ApiResponse<UnknownRecord[]>> & {
  type: typeof actionTypes.GET_FOLLOW_LIST;
};

export const initialState: FollowState = { data: [] };

export function followReducer(
  state: FollowState = initialState,
  action: FollowListAction
): FollowState {
  if (action.type === actionTypes.GET_FOLLOW_LIST) {
    return { ...state, data: action.payload.data.data as UnknownRecord[] };
  }
  return state;
}

export function getFollowList(
  uid: string | number
): PromiseAction<ApiResponse<UnknownRecord[]>> & {
  type: typeof actionTypes.GET_FOLLOW_LIST;
} {
  return {
    type: actionTypes.GET_FOLLOW_LIST,
    payload: axios.get<ApiResponse<UnknownRecord[]>>('/api/follow/list', {
      params: { uid }
    })
  };
}

export function addFollow(param: UnknownRecord): PromiseAction<ApiResponse<unknown>> {
  return {
    type: actionTypes.ADD_FOLLOW,
    payload: axios.post<ApiResponse<unknown>>('/api/follow/add', param)
  };
}

export function delFollow(id: string | number): PromiseAction<ApiResponse<unknown>> {
  return {
    type: actionTypes.DEL_FOLLOW,
    payload: axios.post<ApiResponse<unknown>>('/api/follow/del', { projectid: id })
  };
}

export default followReducer;
