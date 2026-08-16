import axios from 'axios';

import type { ApiResponse } from '../../types/api';
import type { UnknownRecord } from '../types/runtime';

export const actionTypes = { FETCH_MOCK_COL: 'yapi/mockCol/FETCH_MOCK_COL' } as const;
export interface MockColState { list: UnknownRecord[] }
interface MockColAction { type: typeof actionTypes.FETCH_MOCK_COL; payload: ApiResponse<UnknownRecord[]> }
export const initialState: MockColState = { list: [] };

export function mockColReducer(state: MockColState = initialState, action: MockColAction): MockColState {
  switch (action.type) {
    case actionTypes.FETCH_MOCK_COL:
      return { ...state, list: action.payload.data as UnknownRecord[] };
    default:
      return state;
  }
}
export async function fetchMockCol(interfaceId: string | number): Promise<MockColAction> {
  const result = await axios.get<ApiResponse<UnknownRecord[]>>('/api/plugin/advmock/case/list?interface_id=' + interfaceId);
  return { type: actionTypes.FETCH_MOCK_COL, payload: result.data };
}
export default mockColReducer;
