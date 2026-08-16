import type { Action, Reducer } from 'redux';

export type UnknownRecord = Record<string, unknown>;

export interface LegacyReduxAction extends Action<string> {
  [key: string]: unknown;
}

export type DeepPartial<T> = T extends readonly (infer U)[]
  ? DeepPartial<U>[]
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T;

export type LegacyReducerRegistry = Record<
  string,
  Reducer<unknown, LegacyReduxAction>
>;
