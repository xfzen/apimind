/**
 * @author suxiaoxin
 */

const aUniqueVerticalStringNotFoundInData = '___UNIQUE_VERTICAL___';
const aUniqueCommaStringNotFoundInData = '___UNIQUE_COMMA___';
const segmentSeparateChar = '|';
const methodAndArgsSeparateChar = ':';
const argsSeparateChar = ',';

import md5 from 'md5';
import { Base64 } from 'js-base64';
import CryptoJS from 'crypto-js';
import 'crypto-js/sha1';
import 'crypto-js/sha224';
import 'crypto-js/sha256';
import 'crypto-js/sha512';

const stringHandles = {
  md5: function(str) {
    return md5(str);
  },

  sha: function(str, arg) {
    const algo = String(arg || 'sha1').toLowerCase();
    let wa;
    switch (algo) {
      case 'sha1': wa = CryptoJS.SHA1(str); break;
      case 'sha224': wa = CryptoJS.SHA224 ? CryptoJS.SHA224(str) : CryptoJS.SHA256(str); break;
      case 'sha256': wa = CryptoJS.SHA256(str); break;
      case 'sha384': wa = CryptoJS.SHA512(str); break; // fallback
      case 'sha512': wa = CryptoJS.SHA512(str); break;
      default: wa = CryptoJS.SHA1(str);
    }
    return wa.toString(CryptoJS.enc.Hex);
  },

  /**
   * type: sha1 sha224 sha256 sha384 sha512
   */
  sha1: function(str) { return CryptoJS.SHA1(str).toString(CryptoJS.enc.Hex); },

  sha224: function(str) { return (CryptoJS.SHA224 ? CryptoJS.SHA224(str) : CryptoJS.SHA256(str)).toString(CryptoJS.enc.Hex); },

  sha256: function(str) { return CryptoJS.SHA256(str).toString(CryptoJS.enc.Hex); },

  sha384: function(str) { return CryptoJS.SHA512(str).toString(CryptoJS.enc.Hex); },

  sha512: function(str) { return CryptoJS.SHA512(str).toString(CryptoJS.enc.Hex); },

  base64: function(str) {
    return Base64.encode(str);
  },

  unbase64: function(str) {
    return Base64.decode(str);
  },

  substr: function(str, ...args) {
    return str.substr(...args);
  },

  concat: function(str, ...args) {
    args.forEach(item => {
      str += item;
    });
    return str;
  },

  lconcat: function(str, ...args) {
    args.forEach(item => {
      str = item + this._string;
    });
    return str;
  },

  lower: function(str) {
    return str.toLowerCase();
  },

  upper: function(str) {
    return str.toUpperCase();
  },

  length: function(str) {
    return str.length;
  },

  number: function(str) {
    return !isNaN(str) ? +str : str;
  }
};

let handleValue = function(str) {
  return str;
};

const _handleValue = function(str) {
  if (str[0] === str[str.length - 1] && (str[0] === '"' || str[0] === "'")) {
    str = str.substr(1, str.length - 2);
  }
  return handleValue(
    str
      .replace(new RegExp(aUniqueVerticalStringNotFoundInData, 'g'), segmentSeparateChar)
      .replace(new RegExp(aUniqueCommaStringNotFoundInData, 'g'), argsSeparateChar)
  );
};

export class PowerString {
  constructor(str) {
    this._string = str;
  }

  toString() {
    return this._string;
  }
}

function addMethod(method, fn) {
  PowerString.prototype[method] = function(...args) {
    args.unshift(this._string + '');
    this._string = fn.apply(this, args);
    return this;
  };
}

function importMethods(handles) {
  for (let method in handles) {
    addMethod(method, handles[method]);
  }
}

importMethods(stringHandles);

function handleOriginStr(str, handleValueFn) {
  if (!str) return str;
  if (typeof handleValueFn === 'function') {
    handleValue = handleValueFn;
  }
  str = str
    .replace('\\' + segmentSeparateChar, aUniqueVerticalStringNotFoundInData)
    .replace('\\' + argsSeparateChar, aUniqueCommaStringNotFoundInData)
    .split(segmentSeparateChar)
    .map(handleSegment)
    .reduce(execute, null)
    .toString();
  return str;
}

function execute(str, curItem, index) {
  if (index === 0) {
    return new PowerString(curItem);
  }
  return str[curItem.method].apply(str, curItem.args);
}

function handleSegment(str, index) {
  str = str.trim();
  if (index === 0) {
    return _handleValue(str);
  }

  let method,
    args = [];
  if (str.indexOf(methodAndArgsSeparateChar) > 0) {
    str = str.split(methodAndArgsSeparateChar);
    method = str[0].trim();
    args = str[1].split(argsSeparateChar).map(item => _handleValue(item.trim()));
  } else {
    method = str;
  }
  if (typeof stringHandles[method] !== 'function') {
    throw new Error(`This method name(${method}) is not exist.`);
  }

  return {
    method,
    args
  };
}

export const utils = stringHandles;
/**
 * 类似于 angularJs的 filter 功能
 * @params string
 * @params fn 处理参数值函数，默认是一个返回原有参数值函数
 *
 * @expamle
 * filter('string | substr: 1, 10 | md5 | concat: hello ')
 */
export const filter = handleOriginStr;
