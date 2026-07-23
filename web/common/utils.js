import json5 from 'json5';
import Mock from '@apimind/mockjs-safe';
import { filter, utils as stringUtils } from './power-string.js';
import AjvDraft04 from 'ajv-draft-04';
import * as ajvI18n from 'ajv-i18n';

export function simpleJsonPathParse(key, json) {
  if (!key || typeof key !== 'string' || key.indexOf('$.') !== 0 || key.length <= 2) {
    return null;
  }
  let keys = key.substr(2).split('.');
  keys = keys.filter(item => item);
  for (let i = 0, l = keys.length; i < l; i++) {
    try {
      let m = keys[i].match(/(.*?)\[([0-9]+)\]/);
      if (m) {
        json = json[m[1]][m[2]];
      } else {
        json = json[keys[i]];
      }
    } catch (e) {
      json = '';
      break;
    }
  }
  return json;
}

function handleGlobalWord(word, json) {
  if (!word || typeof word !== 'string' || word.indexOf('global.') !== 0) return word;
  let keys = word.split('.').filter(Boolean);
  return json[keys[0]][keys[1]] || word;
}

export function handleMockWord(word) {
  if (!word || typeof word !== 'string' || word[0] !== '@') return word;
  return Mock.mock(word);
}

export function handleJson(data, handleValueFn) {
  if (!data) return data;
  if (typeof data === 'string') {
    return handleValueFn(data);
  } else if (typeof data === 'object') {
    for (let i in data) {
      data[i] = handleJson(data[i], handleValueFn);
    }
  } else {
    return data;
  }
  return data;
}

function handleValueWithFilter(context) {
  return function(match) {
    if (match[0] === '@') return handleMockWord(match);
    if (match.indexOf('$.') === 0) return simpleJsonPathParse(match, context);
    if (match.indexOf('global.') === 0) return handleGlobalWord(match, context);
    return match;
  };
}

function handleFilter(str, match, context) {
  match = match.trim();
  try {
    return filter(match, handleValueWithFilter(context));
  } catch (err) {
    return str;
  }
}

export function handleParamsValue(val, context = {}) {
  const variableRegexp = /\{\{\s*([^}]+?)\}\}/g;
  if (!val || typeof val !== 'string') return val;
  val = val.trim();
  let m = val.match(/^\{\{([^\}]+)\}\}$/);
  if (!m) {
    if (val[0] === '@' || val[0] === '$') return handleFilter(val, val, context);
  } else {
    return handleFilter(val, m[1], context);
  }
  return val.replace(variableRegexp, (str, match) => handleFilter(str, match, context));
}

export const joinPath = (domain, joinPath) => {
  let l = domain.length;
  if (domain[l - 1] === '/') domain = domain.substr(0, l - 1);
  if (joinPath[0] !== '/') joinPath = joinPath.substr(1);
  return domain + joinPath;
};

export function safeArray(arr) {
  return Array.isArray(arr) ? arr : [];
}

export function isJson5(json) {
  if (!json) return false;
  try {
    json = json5.parse(json);
    return json;
  } catch (e) {
    return false;
  }
}

export function isJson(json) {
  if (!json) return false;
  try {
    json = JSON.parse(json);
    return json;
  } catch (e) {
    return false;
  }
}

export function unbase64(base64Str) {
  try {
    return stringUtils.unbase64(base64Str);
  } catch (err) {
    return base64Str;
  }
}

export function json_parse(json) {
  try {
    return JSON.parse(json);
  } catch (err) {
    return json;
  }
}

export function json_format(json) {
  try {
    return JSON.stringify(JSON.parse(json), null, '   ');
  } catch (e) {
    return json;
  }
}

export function ArrayToObject(arr) {
  let obj = {};
  safeArray(arr).forEach(item => {
    obj[item.name] = item.value;
  });
  return obj;
}

export function timeago(timestamp) {
  let minutes, hours, days, seconds, mouth, year;
  const timeNow = parseInt(new Date().getTime() / 1000);
  seconds = timeNow - timestamp;
  if (seconds > 86400 * 30 * 12) year = parseInt(seconds / (86400 * 30 * 12)); else year = 0;
  if (seconds > 86400 * 30) mouth = parseInt(seconds / (86400 * 30)); else mouth = 0;
  if (seconds > 86400) days = parseInt(seconds / 86400); else days = 0;
  if (seconds > 3600) hours = parseInt(seconds / 3600); else hours = 0;
  minutes = parseInt(seconds / 60);
  if (year > 0) return year + '年前';
  if (mouth > 0 && year <= 0) return mouth + '月前';
  if (days > 0 && mouth <= 0) return days + '天前';
  if (days <= 0 && hours > 0) return hours + '小时前';
  if (hours <= 0 && minutes > 0) return minutes + '分钟前';
  if (minutes <= 0 && seconds > 0) return seconds < 30 ? '刚刚' : seconds + '秒前';
  return '刚刚';
}

export function schemaValidator(schema, params) {
  try {
    const ajv = new AjvDraft04({ validateFormats: false, strict: false });
    const localize = ajvI18n.default || ajvI18n;
    schema = schema || { type: 'object', title: 'empty object', properties: {} };
    const validate = ajv.compile(schema);
    let valid = validate(params);
    let message = '';
    if (!valid) {
      (localize.zh || localize.default.zh)(validate.errors);
      message += ajv.errorsText(validate.errors, { separator: '\n' });
    }
    return { valid, message };
  } catch (e) {
    return { valid: false, message: e.message };
  }
}
