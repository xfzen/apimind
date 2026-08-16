import axios from 'axios';

import variable from '../../constants/variable';
import type { ApiResponse } from '../../types/api';
import type { PromiseAction, ResolvedPromiseAction } from '../promiseTypes';
import type { UnknownRecord } from '../types/runtime';

export const actionTypes = {
  FETCH_NEWS_DATA: 'yapi/news/FETCH_NEWS_DATA',
  FETCH_MORE_NEWS: 'yapi/news/FETCH_MORE_NEWS'
} as const;
export interface NewsItem extends UnknownRecord { add_time: number }
export interface NewsData { list: NewsItem[]; total: number }
export interface NewsState { newsData: NewsData; curpage: number }
interface NewsPage { list: NewsItem[]; total: number }
type NewsAction = ResolvedPromiseAction<ApiResponse<NewsPage>> & {
  type: (typeof actionTypes)[keyof typeof actionTypes];
};
export const initialState: NewsState = { newsData: { list: [], total: 0 }, curpage: 1 };

export function newsReducer(state: NewsState = initialState, action: NewsAction): NewsState {
  switch (action.type) {
    case actionTypes.FETCH_NEWS_DATA: {
      const page = action.payload.data.data as NewsPage;
      state.newsData.list = page.list;
      state.curpage = 1;
      state.newsData.list.sort((a, b) => b.add_time - a.add_time);
      return { ...state, newsData: { total: page.total, list: state.newsData.list } };
    }
    case actionTypes.FETCH_MORE_NEWS: {
      const page = action.payload.data.data as NewsPage;
      const list = page.list;
      state.newsData.list.push(...list);
      state.newsData.list.sort((a, b) => b.add_time - a.add_time);
      if (list && list.length) state.curpage++;
      return { ...state, newsData: { total: page.total, list: state.newsData.list } };
    }
    default:
      return state;
  }
}

function newsAction(
  actionType: typeof actionTypes.FETCH_NEWS_DATA | typeof actionTypes.FETCH_MORE_NEWS,
  typeid: string | number, type: string, page: number, limit: number | undefined, selectValue: unknown
): PromiseAction<ApiResponse<NewsPage>> {
  const params = { typeid, type, page, limit: limit ? limit : variable.PAGE_LIMIT, selectValue };
  return { type: actionType, payload: axios.get<ApiResponse<NewsPage>>('/api/log/list', { params }) };
}
export function fetchNewsData(typeid: string | number, type: string, page: number, limit: number | undefined, selectValue: unknown) {
  return newsAction(actionTypes.FETCH_NEWS_DATA, typeid, type, page, limit, selectValue);
}
export function fetchMoreNews(typeid: string | number, type: string, page: number, limit: number | undefined, selectValue: unknown) {
  return newsAction(actionTypes.FETCH_MORE_NEWS, typeid, type, page, limit, selectValue);
}
export function getMockUrl(project_id: string | number) {
  return { type: '', payload: axios.get<ApiResponse<UnknownRecord>>('/api/project/get', { params: { id: project_id } }) };
}
export function fetchUpdateLogData(params: UnknownRecord) {
  return { type: '', payload: axios.post<ApiResponse<UnknownRecord>>('/api/log/list_by_update', params) };
}
export default newsReducer;
