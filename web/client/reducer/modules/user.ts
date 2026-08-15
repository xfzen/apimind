import axios from 'axios';

import { hasApiData } from '../../types/api';
import type {
  BreadcrumbItem,
  LoginCredentials,
  LoginResponse,
  RegisterCredentials,
  RegisterResponse,
  UserOperationResponse,
  UserState,
  UserStatusResponse
} from '../../types/user';
import type { PromiseAction, ResolvedPromiseAction } from '../promiseTypes';

const LOGIN = 'yapi/user/LOGIN' as const;
const LOGIN_OUT = 'yapi/user/LOGIN_OUT' as const;
const LOGIN_TYPE = 'yapi/user/LOGIN_TYPE' as const;
const GET_LOGIN_STATE = 'yapi/user/GET_LOGIN_STATE' as const;
const REGISTER = 'yapi/user/REGISTER' as const;
const SET_BREADCRUMB = 'yapi/user/SET_BREADCRUMB' as const;
const CHANGE_STUDY_TIP = 'yapi/user/CHANGE_STUDY_TIP' as const;
const FINISH_STUDY = 'yapi/user/FINISH_STUDY' as const;
const SET_IMAGE_URL = 'yapi/user/SET_IMAGE_URL' as const;

const LOADING_STATUS = 0;
const GUEST_STATUS = 1;
const MEMBER_STATUS = 2;

export const userActionTypes = {
  LOGIN,
  LOGIN_OUT,
  LOGIN_TYPE,
  GET_LOGIN_STATE,
  REGISTER,
  SET_BREADCRUMB,
  CHANGE_STUDY_TIP,
  FINISH_STUDY,
  SET_IMAGE_URL
} as const;

export const initialUserState: UserState = {
  isLogin: false,
  canRegister: true,
  isLDAP: false,
  userName: null,
  uid: null,
  email: '',
  loginState: LOADING_STATUS,
  loginWrapActiveKey: '1',
  role: '',
  type: '',
  breadcrumb: [],
  studyTip: 0,
  study: false,
  imageUrl: ''
};

type GetLoginStateAction = ResolvedPromiseAction<UserStatusResponse> & {
  type: typeof GET_LOGIN_STATE;
};
type LoginAction = ResolvedPromiseAction<LoginResponse> & { type: typeof LOGIN };
type RegisterAction = ResolvedPromiseAction<RegisterResponse> & {
  type: typeof REGISTER;
};
type LoginOutAction = ResolvedPromiseAction<UserOperationResponse> & {
  type: typeof LOGIN_OUT;
};
type FinishStudyAction = ResolvedPromiseAction<UserOperationResponse> & {
  type: typeof FINISH_STUDY;
};
interface LoginTypeAction {
  type: typeof LOGIN_TYPE;
  index: string;
}
interface SetBreadcrumbAction {
  type: typeof SET_BREADCRUMB;
  data: BreadcrumbItem[];
}
interface ChangeStudyTipAction {
  type: typeof CHANGE_STUDY_TIP;
}
interface SetImageUrlAction {
  type: typeof SET_IMAGE_URL;
  data: string;
}

type UserAction =
  | GetLoginStateAction
  | LoginAction
  | RegisterAction
  | LoginOutAction
  | LoginTypeAction
  | SetBreadcrumbAction
  | ChangeStudyTipAction
  | FinishStudyAction
  | SetImageUrlAction;

export function userReducer(
  state: UserState = initialUserState,
  action: UserAction
): UserState {
  switch (action.type) {
    case GET_LOGIN_STATE: {
      const response = action.payload.data;
      const user = response.data;
      return {
        ...state,
        isLogin: response.errcode === 0,
        isLDAP: response.ladp,
        canRegister: response.canRegister,
        role: user ? user.role : null,
        loginState: response.errcode === 0 ? MEMBER_STATUS : GUEST_STATUS,
        userName: user ? user.username : null,
        uid: user ? user._id : null,
        type: user ? user.type : null,
        study: user ? user.study : false
      };
    }
    case LOGIN: {
      const response = action.payload.data;
      if (!hasApiData(response)) {
        return state;
      }
      return {
        ...state,
        isLogin: true,
        loginState: MEMBER_STATUS,
        uid: response.data.uid,
        userName: response.data.username,
        role: response.data.role,
        type: response.data.type,
        study: response.data.study
      };
    }
    case LOGIN_OUT:
      return {
        ...state,
        isLogin: false,
        loginState: GUEST_STATUS,
        userName: null,
        uid: null,
        role: '',
        type: ''
      };
    case LOGIN_TYPE:
      return {
        ...state,
        loginWrapActiveKey: action.index
      };
    case REGISTER: {
      const response = action.payload.data;
      if (!hasApiData(response)) {
        return state;
      }
      return {
        ...state,
        isLogin: true,
        loginState: MEMBER_STATUS,
        uid: response.data.uid,
        userName: response.data.username,
        type: response.data.type,
        study: response.data.study
      };
    }
    case SET_BREADCRUMB:
      return {
        ...state,
        breadcrumb: action.data
      };
    case CHANGE_STUDY_TIP:
      return {
        ...state,
        studyTip: state.studyTip + 1
      };
    case FINISH_STUDY:
      return {
        ...state,
        study: true,
        studyTip: 0
      };
    case SET_IMAGE_URL:
      return {
        ...state,
        imageUrl: action.data
      };
    default:
      return state;
  }
}

export default userReducer;

export function checkLoginState(): PromiseAction<UserStatusResponse> {
  return {
    type: GET_LOGIN_STATE,
    payload: axios.get<UserStatusResponse>('/api/user/status')
  };
}

export function loginActions(data: LoginCredentials): PromiseAction<LoginResponse> {
  return {
    type: LOGIN,
    payload: axios.post<LoginResponse>('/api/user/login', data)
  };
}

export function loginLdapActions(data: LoginCredentials): PromiseAction<LoginResponse> {
  return {
    type: LOGIN,
    payload: axios.post<LoginResponse>('/api/user/login_by_ldap', data)
  };
}

export function regActions(data: RegisterCredentials): PromiseAction<RegisterResponse> {
  const { email, password, userName } = data;
  const param = {
    email,
    password,
    username: userName
  };
  return {
    type: REGISTER,
    payload: axios.post<RegisterResponse>('/api/user/reg', param)
  };
}

export function logoutActions(): PromiseAction<UserOperationResponse> {
  return {
    type: LOGIN_OUT,
    payload: axios.get<UserOperationResponse>('/api/user/logout')
  };
}

export function loginTypeAction(index: string): LoginTypeAction {
  return {
    type: LOGIN_TYPE,
    index
  };
}

export function setBreadcrumb(data: BreadcrumbItem[]): SetBreadcrumbAction {
  return {
    type: SET_BREADCRUMB,
    data
  };
}

export function setImageUrl(data: string): SetImageUrlAction {
  return {
    type: SET_IMAGE_URL,
    data
  };
}

export function changeStudyTip(): ChangeStudyTipAction {
  return {
    type: CHANGE_STUDY_TIP
  };
}

export function finishStudy(): PromiseAction<UserOperationResponse> {
  return {
    type: FINISH_STUDY,
    payload: axios.get<UserOperationResponse>('/api/user/up_study')
  };
}
