import json5 from 'json5';
import Mock from '@apimind/mockjs-safe';
import { filter, utils as stringUtils } from './power-string.js';
import AjvDraft04 from 'ajv-draft-04';
import * as ajvI18n from 'ajv-i18n';
import type { ErrorObject } from 'ajv';
import type { NamedValue, ValidationResult } from './types/schema';

type UnknownRecord = Record<string, unknown>;
type Localize = (errors: ErrorObject[] | null | undefined) => void;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function simpleJsonPathParse(key: unknown, json: unknown): unknown | null {
  if (!key || typeof key !== 'string' || key.indexOf('$.') !== 0 || key.length <= 2) {
    return null;
  }
  let keys = key.substr(2).split('.');
  keys = keys.filter(item => item);
  let current = json;
  for (let i = 0, l = keys.length; i < l; i++) {
    try {
      let m = keys[i].match(/(.*?)\[([0-9]+)\]/);
      if (m) {
        if (!isRecord(current)) throw new Error('invalid path');
        const array = current[m[1]];
        if (!Array.isArray(array)) throw new Error('invalid path');
        current = array[Number(m[2])];
      } else {
        if (!isRecord(current)) throw new Error('invalid path');
        current = current[keys[i]];
      }
    } catch {
      current = '';
      break;
    }
  }
  return current;
}

function handleGlobalWord(word: unknown, json: UnknownRecord): unknown {
  if (!word || typeof word !== 'string' || word.indexOf('global.') !== 0) return word;
  let keys = word.split('.').filter(Boolean);
  const namespace = json[keys[0]];
  return (isRecord(namespace) && namespace[keys[1]]) || word;
}

export function handleMockWord(word: unknown): unknown {
  if (!word || typeof word !== 'string' || word[0] !== '@') return word;
  const mockRuntime = Mock as unknown as { mock(template: string): unknown };
  return mockRuntime.mock(word);
}

export function handleJson(data: unknown, handleValueFn: (value: string) => unknown): unknown {
  if (!data) return data;
  if (typeof data === 'string') {
    return handleValueFn(data);
  } else if (Array.isArray(data)) {
    for (let i = 0; i < data.length; i++) {
      data[i] = handleJson(data[i], handleValueFn);
    }
  } else if (isRecord(data)) {
    for (const key of Object.keys(data)) {
      data[key] = handleJson(data[key], handleValueFn);
    }
  } else {
    return data;
  }
  return data;
}

function handleValueWithFilter(context: UnknownRecord): (match: string) => unknown {
  return function(match: string): unknown {
    if (match[0] === '@') return handleMockWord(match);
    if (match.indexOf('$.') === 0) return simpleJsonPathParse(match, context);
    if (match.indexOf('global.') === 0) return handleGlobalWord(match, context);
    return match;
  };
}

function handleFilter(str: string, match: string, context: UnknownRecord): unknown {
  match = match.trim();
  try {
    return filter(match, handleValueWithFilter(context));
  } catch (err) {
    return str;
  }
}

export function handleParamsValue(val: unknown, context: UnknownRecord = {}): unknown {
  const variableRegexp = /\{\{\s*([^}]+?)\}\}/g;
  if (!val || typeof val !== 'string') return val;
  const normalized = val.trim();
  let m = normalized.match(/^\{\{([^\}]+)\}\}$/);
  if (!m) {
    if (normalized[0] === '@' || normalized[0] === '$') return handleFilter(normalized, normalized, context);
  } else {
    return handleFilter(normalized, m[1], context);
  }
  return normalized.replace(variableRegexp, (str: string, match: string) => handleFilter(str, match, context) as string);
}

export const joinPath = (domain: string, joinPath: string): string => {
  let l = domain.length;
  if (domain[l - 1] === '/') domain = domain.substr(0, l - 1);
  if (joinPath[0] !== '/') joinPath = joinPath.substr(1);
  return domain + joinPath;
};

export function safeArray<T>(arr: unknown): T[] {
  return Array.isArray(arr) ? arr as T[] : [];
}

export function isJson5(json: unknown): unknown | false {
  if (!json) return false;
  try {
    json = json5.parse(json as string);
    return json;
  } catch (e) {
    return false;
  }
}

export function isJson(json: unknown): unknown | false {
  if (!json) return false;
  try {
    json = JSON.parse(json as string);
    return json;
  } catch (e) {
    return false;
  }
}

export function unbase64(base64Str: string): string {
  try {
    return stringUtils.unbase64(base64Str);
  } catch (err) {
    return base64Str;
  }
}

export function json_parse(json: string): unknown {
  try {
    return JSON.parse(json);
  } catch (err) {
    return json;
  }
}

export function json_format(json: string): string {
  try {
    return JSON.stringify(JSON.parse(json), null, '   ');
  } catch (e) {
    return json;
  }
}

export function ArrayToObject(arr: readonly NamedValue[]): Record<string, unknown> {
  let obj: Record<string, unknown> = {};
  safeArray<NamedValue>(arr).forEach(item => {
    obj[item.name] = item.value;
  });
  return obj;
}

export function timeago(timestamp: number): string {
  let minutes, hours, days, seconds, mouth, year;
  const timeNow = parseInt(String(new Date().getTime() / 1000));
  seconds = timeNow - timestamp;
  if (seconds > 86400 * 30 * 12) year = parseInt(String(seconds / (86400 * 30 * 12))); else year = 0;
  if (seconds > 86400 * 30) mouth = parseInt(String(seconds / (86400 * 30))); else mouth = 0;
  if (seconds > 86400) days = parseInt(String(seconds / 86400)); else days = 0;
  if (seconds > 3600) hours = parseInt(String(seconds / 3600)); else hours = 0;
  minutes = parseInt(String(seconds / 60));
  if (year > 0) return year + '年前';
  if (mouth > 0 && year <= 0) return mouth + '月前';
  if (days > 0 && mouth <= 0) return days + '天前';
  if (days <= 0 && hours > 0) return hours + '小时前';
  if (hours <= 0 && minutes > 0) return minutes + '分钟前';
  if (minutes <= 0 && seconds > 0) return seconds < 30 ? '刚刚' : seconds + '秒前';
  return '刚刚';
}

export function schemaValidator(schema: object | null | undefined, params: unknown): ValidationResult {
  try {
    const ajv = new AjvDraft04({ validateFormats: false, strict: false });
    const localize = ajvI18n as unknown as { zh?: Localize; default?: { zh?: Localize } };
    schema = schema || { type: 'object', title: 'empty object', properties: {} };
    const validate = ajv.compile(schema);
    let valid = validate(params);
    let message = '';
    if (!valid) {
      const localizeZh = localize.zh || localize.default?.zh;
      localizeZh?.(validate.errors);
      message += ajv.errorsText(validate.errors, { separator: '\n' });
    }
    return { valid, message };
  } catch (e) {
    return { valid: false, message: errorMessage(e) };
  }
}
