import type { ApiResponse } from './api';

export interface UserInfo {
  _id: number;
  id: number;
  uid: number;
  username: string;
  email: string;
  role: string;
  type: string;
  study: boolean;
  add_time?: number;
  up_time?: number;
}

export interface UserStatusResponse extends ApiResponse<UserInfo> {
  ladp: boolean;
  canRegister: boolean;
}

export type LoginResponse = ApiResponse<UserInfo>;
export type RegisterResponse = ApiResponse<UserInfo>;
export type UserOperationResponse = ApiResponse<null>;

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials extends LoginCredentials {
  userName: string;
  confirm: string;
}

export interface BreadcrumbItem {
  name: string;
  href?: string;
}

export type LoginStateCode = 0 | 1 | 2;

export interface UserState {
  isLogin: boolean;
  canRegister: boolean;
  isLDAP: boolean;
  userName: string | null;
  uid: number | null;
  email: string;
  loginState: LoginStateCode;
  loginWrapActiveKey: string;
  role: string | null;
  type: string | null;
  breadcrumb: BreadcrumbItem[];
  studyTip: number;
  study: boolean;
  imageUrl: string;
}
