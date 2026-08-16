import { combineReducers } from 'redux';
import user from './user';
import group from './group.js';
import project from './project.js';
import inter from './interface';
import interfaceCol from './interfaceCol';
import news from './news';
import addInterface from './addInterface';
import menu from './menu';
import follow from './follow';
import mockCol from './mockCol';
import template from './template';
import docs from './docs';

import { emitHook } from 'client/plugin.js';

const reducerModules = {
  group,
  user,
  inter,
  interfaceCol,
  project,
  news,
  addInterface,
  menu,
  follow,
  mockCol,
  template,
  docs
};
emitHook('add_reducer', reducerModules);

export default combineReducers(reducerModules);
