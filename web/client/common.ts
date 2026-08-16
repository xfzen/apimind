import moment from 'moment';
import * as constants from './constants/variable.js';
import Mock from '@apimind/mockjs-safe';
import json5 from 'json5';
import MockExtra from 'common/mock-extra';

const Roles: Record<string, string> = {
  0: 'admin',
  10: 'owner',
  20: 'dev',
  30: 'guest',
  40: 'member'
};

const roleAction: Record<string, string> = {
  manageUserlist: 'admin',
  changeMemberRole: 'owner',
  editInterface: 'dev',
  viewPrivateInterface: 'guest',
  viewGroup: 'guest'
};

export function isJson(json: unknown): unknown | false {
  if (!json) {
    return false;
  }
  try {
    json = JSON.parse(json as string);
    return json;
  } catch (e) {
    return false;
  }
}

export function isJson5(json: unknown): unknown | false {
  if (!json) {
    return false;
  }
  try {
    json = json5.parse(json as string);
    return json;
  } catch (e) {
    return false;
  }
}
export const safeArray = function<T>(arr: unknown): T[] {
  return Array.isArray(arr) ? arr as T[] : [];
};

export const json5_parse = function(json: string): unknown {
  try {
    return json5.parse(json);
  } catch (err) {
    return json;
  }
};

export const json_parse = function(json: string): unknown {
  try {
    return JSON.parse(json);
  } catch (err) {
    return json;
  }
};

export function deepCopyJson<T>(json: T): T {
  return JSON.parse(JSON.stringify(json));
}

export const checkAuth = (action: string, role: string | number): boolean => {
  return Roles[roleAction[action]] <= Roles[role];
};

export const formatTime = (timestamp: number): string => {
  return moment.unix(timestamp).format('YYYY-MM-DD HH:mm:ss');
};

// 防抖函数，减少高频触发的函数执行的频率
// 请在 constructor 里使用:
// import { debounce } from '$/common';
// this.func = debounce(this.func, 400);
export const debounce = (func: () => void, wait: number): (() => void) => {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  return function(): void {
    clearTimeout(timeout);
    timeout = setTimeout(func, wait);
  };
};

// 从 Javascript 对象中选取随机属性
export const pickRandomProperty = (obj: Record<string, unknown>): string | undefined => {
  let result: string | undefined;
  let count = 0;
  for (let prop in obj) {
    if (Math.random() < 1 / ++count) {
      result = prop;
    }
  }
  return result;
};

export const getImgPath = (path: string, type: string): string => {
  let rate = window.devicePixelRatio >= 2 ? 2 : 1;
  return `${path}@${rate}x.${type}`;
};

export function trim(str: string | number | null | undefined): string | number | null | undefined {
  if (!str) {
    return str;
  }

  str = str + '';

  return str.replace(/(^\s*)|(\s*$)/g, '');
}

export const handlePath = (path: string | null | undefined): string | null | undefined => {
  path = trim(path) as string | null | undefined;
  if (!path) {
    return path;
  }
  if (path === '/') {
    return '';
  }
  path = path[0] !== '/' ? '/' + path : path;
  path = path[path.length - 1] === '/' ? path.substr(0, path.length - 1) : path;
  return path;
};

export const handleApiPath = (path: string | null | undefined): string => {
  if (!path) {
    return '';
  }
  path = trim(path) as string;
  path = path[0] !== '/' ? '/' + path : path;
  return path;
};

// 名称限制 constants.NAME_LIMIT 字符
export interface LegacyFormRule {
  required: boolean;
  validator: (rule: unknown, value: unknown, callback: (message?: string) => void) => void;
}

export const nameLengthLimit = (type: string): LegacyFormRule[] => {
  // 返回字符串长度，汉字计数为2
  const strLength = (str: string): number => {
    let length = 0;
    for (let i = 0; i < str.length; i++) {
      str.charCodeAt(i) > 255 ? (length += 2) : length++;
    }
    return length;
  };
  // 返回 form中的 rules 校验规则
  return [
    {
      required: true,
      validator(_rule: unknown, value: unknown, callback: (message?: string) => void) {
        const len = typeof value === 'string' && value ? strLength(value) : 0;
        if (len > constants.NAME_LIMIT) {
          callback(
            '请输入' + type + '名称，长度不超过' + constants.NAME_LIMIT + '字符(中文算作2字符)!'
          );
        } else if (len === 0) {
          callback(
            '请输入' + type + '名称，长度不超过' + constants.NAME_LIMIT + '字符(中文算作2字符)!'
          );
        } else {
          return callback();
        }
      }
    }
  ];
};

// 去除所有html标签只保留文字

export const htmlFilter = (html: string): string => {
  let reg = /<\/?.+?\/?>/g;
  return html.replace(reg, '') || '新项目';
};

// 实现 Object.entries() 方法
export const entries = <T>(obj: Record<string, T>): Array<[string, T]> => {
  let res: Array<[string, T]> = [];
  for (let key in obj) {
    res.push([key, obj[key]]);
  }
  return res;
};

export const getMockText = (mockTpl: string): string => {
  try {
    const mockRuntime = Mock as unknown as { mock(template: unknown): unknown };
    return JSON.stringify(mockRuntime.mock(MockExtra(json5.parse(mockTpl), {})), null, '  ');
  } catch (err) {
    return '';
  }
};
/**
 * 合并后新的对象属性与 Obj 一致，nextObj 有对应属性则取 nextObj 属性值，否则取 Obj 属性值
 * @param  {Object} Obj     旧对象
 * @param  {Object} nextObj 新对象
 * @return {Object}           合并后的对象
 */
export const safeAssign = <T extends Record<string, unknown>>(Obj: T, nextObj: Partial<T>): T => {
  let keys = Object.keys(nextObj);
  return Object.keys(Obj).reduce((result, value) => {
    const key = value as keyof T;
    if (keys.indexOf(value) >= 0) {
      result[key] = nextObj[key] as T[keyof T];
    } else {
      result[key] = Obj[key];
    }
    return result;
  }, {} as T);
};

// 交换数组的位置
export const arrayChangeIndex = <T extends { _id: string | number }>(
  arr: readonly T[],
  start: number,
  end: number
): Array<{ id: T['_id']; index: number }> => {
  let newArr = ([] as T[]).concat(arr);
  // newArr[start] = arr[end];
  // newArr[end] = arr[start];
  let startItem = newArr[start];
  newArr.splice(start, 1);
  // end自动加1
  newArr.splice(end, 0, startItem);
  let changes: Array<{ id: T['_id']; index: number }> = [];
  newArr.forEach((item, index) => {
    changes.push({
      id: item._id,
      index: index
    });
  });

  return changes;
};
