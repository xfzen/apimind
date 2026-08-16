export const actionTypes = {
  CHANGE_MENU_ITEM: 'yapi/menu/CHANGE_MENU_ITEM'
} as const;

export interface MenuState {
  curKey: string;
}

interface ChangeMenuItemAction {
  type: typeof actionTypes.CHANGE_MENU_ITEM;
  data: string;
}

type MenuAction = ChangeMenuItemAction;

export const initialState: MenuState = {
  curKey: '/' + window.location.hash.split('/')[1]
};

export function menuReducer(
  state: MenuState = initialState,
  action: MenuAction
): MenuState {
  if (action.type === actionTypes.CHANGE_MENU_ITEM) {
    return { ...state, curKey: action.data };
  }
  return state;
}

export function changeMenuItem(curKey: string): ChangeMenuItemAction {
  return { type: actionTypes.CHANGE_MENU_ITEM, data: curKey };
}

export default menuReducer;
