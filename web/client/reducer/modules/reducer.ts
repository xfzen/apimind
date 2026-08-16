import { combineReducers } from 'redux';

import { emitHook } from 'client/plugin.js';
import addInterface from './addInterface';
import docs from './docs';
import follow from './follow';
import group from './group';
import inter from './interface';
import interfaceCol from './interfaceCol';
import menu from './menu';
import mockCol from './mockCol';
import news from './news';
import project from './project';
import template from './template';
import user from './user';
import type { LegacyReducerRegistry } from '../types/runtime';

export const fixedReducerModules = {
  group, user, inter, interfaceCol, project, news,
  addInterface, menu, follow, mockCol, template, docs
};

export type RootState = {
  [K in keyof typeof fixedReducerModules]: ReturnType<(typeof fixedReducerModules)[K]>;
};

const reducerModules = {
  ...fixedReducerModules
} as typeof fixedReducerModules & LegacyReducerRegistry;

emitHook('add_reducer', reducerModules);

export const rootReducer = combineReducers(reducerModules);
export default rootReducer;
