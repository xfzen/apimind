export type HttpMethod =
  | 'GET'
  | 'POST'
  | 'PUT'
  | 'DELETE'
  | 'HEAD'
  | 'OPTIONS'
  | 'PATCH';

export interface HttpMethodConfig {
  readonly request_body: boolean;
  readonly default_tab: 'query' | 'body';
}
