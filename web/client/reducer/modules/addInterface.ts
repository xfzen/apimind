import axios from 'axios';

import type { ApiResponse } from '../../types/api';
import type { PromiseAction, ResolvedPromiseAction } from '../promiseTypes';
import type { UnknownRecord } from '../types/runtime';

export const actionTypes = {
  FETCH_ADD_INTERFACE_INPUT: 'yapi/addInterface/FETCH_ADD_INTERFACE_INPUT',
  FETCH_ADD_INTERFACE_TAG_VALUE: 'yapi/addInterface/FETCH_ADD_INTERFACE_TAG_VALUE',
  FETCH_ADD_INTERFACE_HEADER_VALUE: 'yapi/addInterface/FETCH_ADD_INTERFACE_HEADER_VALUE',
  ADD_INTERFACE_SEQ_HEADER: 'yapi/addInterface/ADD_INTERFACE_SEQ_HEADER',
  DELETE_INTERFACE_SEQ_HEADER: 'yapi/addInterface/DELETE_INTERFACE_SEQ_HEADER',
  GET_INTERFACE_REQ_PARAMS: 'yapi/addInterface/GET_INTERFACE_REQ_PARAMS',
  GET_INTERFACE_RES_PARAMS: 'yapi/addInterface/GET_INTERFACE_RES_PARAMS',
  PUSH_INTERFACE_NAME: 'yapi/addInterface/PUSH_INTERFACE_NAME',
  PUSH_INTERFACE_METHOD: 'yapi/addInterface/PUSH_INTERFACE_METHOD',
  FETCH_INTERFACE_PROJECT: 'yapi/addInterface/FETCH_INTERFACE_PROJECT',
  ADD_INTERFACE_CLIPBOARD: 'yapi/addInterface/ADD_INTERFACE_CLIPBOARD'
} as const;

export interface SequenceHeader {
  id: string | number;
  name: string;
  value: string;
}

export interface AddInterfaceState {
  interfaceName: string;
  url: string;
  method: string;
  tagValue?: string;
  headerValue?: string;
  seqGroup: SequenceHeader[];
  reqParams: string;
  resParams: string;
  project: UnknownRecord;
  clipboard: () => void;
}

type StringPayloadType =
  | typeof actionTypes.FETCH_ADD_INTERFACE_INPUT
  | typeof actionTypes.FETCH_ADD_INTERFACE_TAG_VALUE
  | typeof actionTypes.FETCH_ADD_INTERFACE_HEADER_VALUE
  | typeof actionTypes.GET_INTERFACE_REQ_PARAMS
  | typeof actionTypes.GET_INTERFACE_RES_PARAMS
  | typeof actionTypes.PUSH_INTERFACE_NAME
  | typeof actionTypes.PUSH_INTERFACE_METHOD;

interface StringPayloadAction {
  type: StringPayloadType;
  payload: string;
}

interface SequenceHeaderAction {
  type:
    | typeof actionTypes.ADD_INTERFACE_SEQ_HEADER
    | typeof actionTypes.DELETE_INTERFACE_SEQ_HEADER;
  payload: SequenceHeader[];
}

type ProjectAction = ResolvedPromiseAction<ApiResponse<UnknownRecord>> & {
  type: typeof actionTypes.FETCH_INTERFACE_PROJECT;
};

interface ClipboardAction {
  type: typeof actionTypes.ADD_INTERFACE_CLIPBOARD;
  payload: () => void;
}

type AddInterfaceAction =
  | StringPayloadAction
  | SequenceHeaderAction
  | ProjectAction
  | ClipboardAction;

export const initialState: AddInterfaceState = {
  interfaceName: '',
  url: '',
  method: 'GET',
  seqGroup: [{ id: 0, name: '', value: '' }],
  reqParams: '',
  resParams: '',
  project: {},
  clipboard: () => {}
};

export function addInterfaceReducer(
  state: AddInterfaceState = initialState,
  action: AddInterfaceAction
): AddInterfaceState {
  switch (action.type) {
    case actionTypes.FETCH_ADD_INTERFACE_INPUT:
      return { ...state, url: action.payload };
    case actionTypes.FETCH_ADD_INTERFACE_TAG_VALUE:
      return { ...state, tagValue: action.payload };
    case actionTypes.FETCH_ADD_INTERFACE_HEADER_VALUE:
      return { ...state, headerValue: action.payload };
    case actionTypes.ADD_INTERFACE_SEQ_HEADER:
    case actionTypes.DELETE_INTERFACE_SEQ_HEADER:
      return { ...state, seqGroup: action.payload };
    case actionTypes.GET_INTERFACE_REQ_PARAMS:
      return { ...state, reqParams: action.payload };
    case actionTypes.GET_INTERFACE_RES_PARAMS:
      return { ...state, resParams: action.payload };
    case actionTypes.PUSH_INTERFACE_NAME:
      return { ...state, interfaceName: action.payload };
    case actionTypes.PUSH_INTERFACE_METHOD:
      return { ...state, method: action.payload };
    case actionTypes.FETCH_INTERFACE_PROJECT:
      return { ...state, project: action.payload.data.data as UnknownRecord };
    case actionTypes.ADD_INTERFACE_CLIPBOARD:
      return { ...state, clipboard: action.payload };
    default:
      return state;
  }
}

function stringAction(type: StringPayloadType, payload: string): StringPayloadAction {
  return { type, payload };
}

export const pushInputValue = (value: string) =>
  stringAction(actionTypes.FETCH_ADD_INTERFACE_INPUT, value);
export const reqTagValue = (value: string) =>
  stringAction(actionTypes.FETCH_ADD_INTERFACE_TAG_VALUE, value);
export const reqHeaderValue = (value: string) =>
  stringAction(actionTypes.FETCH_ADD_INTERFACE_HEADER_VALUE, value);
export const getReqParams = (value: string) =>
  stringAction(actionTypes.GET_INTERFACE_REQ_PARAMS, value);
export const getResParams = (value: string) =>
  stringAction(actionTypes.GET_INTERFACE_RES_PARAMS, value);
export const pushInterfaceName = (value: string) =>
  stringAction(actionTypes.PUSH_INTERFACE_NAME, value);
export const pushInterfaceMethod = (value: string) =>
  stringAction(actionTypes.PUSH_INTERFACE_METHOD, value);

export function addReqHeader(value: SequenceHeader[]): SequenceHeaderAction {
  return { type: actionTypes.ADD_INTERFACE_SEQ_HEADER, payload: value };
}

export function deleteReqHeader(value: SequenceHeader[]): SequenceHeaderAction {
  return { type: actionTypes.DELETE_INTERFACE_SEQ_HEADER, payload: value };
}

export function fetchInterfaceProject(
  id: string | number
): PromiseAction<ApiResponse<UnknownRecord>> & {
  type: typeof actionTypes.FETCH_INTERFACE_PROJECT;
} {
  return {
    type: actionTypes.FETCH_INTERFACE_PROJECT,
    payload: axios.get<ApiResponse<UnknownRecord>>('/api/project/get', { params: { id } })
  };
}

export function addInterfaceClipboard(func: () => void): ClipboardAction {
  return { type: actionTypes.ADD_INTERFACE_CLIPBOARD, payload: func };
}

export default addInterfaceReducer;
