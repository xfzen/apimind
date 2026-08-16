import { message } from 'antd';

import type { LegacyReduxAction, UnknownRecord } from '../types/runtime';

type Next = (action: LegacyReduxAction) => unknown;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null;
}

export function messageMiddleware() {
  return (next: Next) => (action: LegacyReduxAction | null | undefined): unknown => {
    if (!action) {
      return;
    }
    if (action.error) {
      const payload = isRecord(action.payload) ? action.payload : undefined;
      message.error((payload && typeof payload.message === 'string' && payload.message) || '服务器错误');
    } else if (isRecord(action.payload) && isRecord(action.payload.data)) {
      const data = action.payload.data;
      if (data.errcode && data.errcode !== 40011) {
        const errorMessage = typeof data.errmsg === 'string' ? data.errmsg : String(data.errmsg);
        message.error(errorMessage);
        throw new Error(errorMessage);
      }
    }
    return next(action);
  };
}

export default messageMiddleware;
