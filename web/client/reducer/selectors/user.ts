import type { UserState } from '../../types/user';

export interface UserRootState {
  user: UserState;
}

export const selectUser = (state: UserRootState): UserState => state.user;
export const selectLoginState = (state: UserRootState) => selectUser(state).loginState;
export const selectIsAuthenticated = (state: UserRootState) => selectUser(state).isLogin;
export const selectIsLdap = (state: UserRootState) => selectUser(state).isLDAP;
export const selectCanRegister = (state: UserRootState) => selectUser(state).canRegister;
export const selectLoginWrapActiveKey = (state: UserRootState) =>
  selectUser(state).loginWrapActiveKey;
