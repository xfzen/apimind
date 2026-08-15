import type { AxiosResponse } from 'axios';
import type { Dispatch } from 'redux';

export interface PromiseAction<TResponse> {
  type: string;
  payload: Promise<AxiosResponse<TResponse>>;
}

export interface ResolvedPromiseAction<TResponse> {
  type: string;
  payload: AxiosResponse<TResponse>;
}

export interface AppDispatch extends Dispatch {
  <TResponse>(
    action: PromiseAction<TResponse>
  ): Promise<ResolvedPromiseAction<TResponse>>;
}
