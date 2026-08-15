export interface ApiResponse<T> {
  errcode: number;
  errmsg: string;
  data: T | null;
}

export function hasApiData<T>(
  response: ApiResponse<T>
): response is ApiResponse<T> & { data: T } {
  return response.errcode === 0 && response.data !== null;
}
