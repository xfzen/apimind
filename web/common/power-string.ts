/**
 * @author suxiaoxin
 */

import CryptoJS from 'crypto-js';
import 'crypto-js/sha1';
import 'crypto-js/sha224';
import 'crypto-js/sha256';
import 'crypto-js/sha512';
import { Base64 } from 'js-base64';
import md5 from 'md5';

const aUniqueVerticalStringNotFoundInData = '___UNIQUE_VERTICAL___';
const aUniqueCommaStringNotFoundInData = '___UNIQUE_COMMA___';
const segmentSeparateChar = '|';
const methodAndArgsSeparateChar = ':';
const argsSeparateChar = ',';

export type StringTransform = (
  this: PowerString,
  value: string,
  ...args: unknown[]
) => unknown;

interface MethodSegment {
  method: string;
  args: unknown[];
}

const stringHandles: Record<string, StringTransform> = {
  md5(str) {
    return md5(str);
  },

  sha(str, arg) {
    const algo = String(arg || 'sha1').toLowerCase();
    let wordArray: CryptoJS.lib.WordArray;
    switch (algo) {
      case 'sha1':
        wordArray = CryptoJS.SHA1(str);
        break;
      case 'sha224':
        wordArray = CryptoJS.SHA224 ? CryptoJS.SHA224(str) : CryptoJS.SHA256(str);
        break;
      case 'sha256':
        wordArray = CryptoJS.SHA256(str);
        break;
      case 'sha384':
        wordArray = CryptoJS.SHA512(str);
        break;
      case 'sha512':
        wordArray = CryptoJS.SHA512(str);
        break;
      default:
        wordArray = CryptoJS.SHA1(str);
    }
    return wordArray.toString(CryptoJS.enc.Hex);
  },

  sha1(str) {
    return CryptoJS.SHA1(str).toString(CryptoJS.enc.Hex);
  },

  sha224(str) {
    return (CryptoJS.SHA224 ? CryptoJS.SHA224(str) : CryptoJS.SHA256(str)).toString(
      CryptoJS.enc.Hex
    );
  },

  sha256(str) {
    return CryptoJS.SHA256(str).toString(CryptoJS.enc.Hex);
  },

  sha384(str) {
    return CryptoJS.SHA512(str).toString(CryptoJS.enc.Hex);
  },

  sha512(str) {
    return CryptoJS.SHA512(str).toString(CryptoJS.enc.Hex);
  },

  base64(str) {
    return Base64.encode(str);
  },

  unbase64(str) {
    return Base64.decode(str);
  },

  substr(str, ...args) {
    const start = Number(args[0]);
    const length = args[1] === undefined ? undefined : Number(args[1]);
    return str.substr(start, length);
  },

  concat(str, ...args) {
    args.forEach(item => {
      str += String(item);
    });
    return str;
  },

  lconcat(str, ...args) {
    args.forEach(item => {
      str = String(item) + String(this._string);
    });
    return str;
  },

  lower(str) {
    return str.toLowerCase();
  },

  upper(str) {
    return str.toUpperCase();
  },

  length(str) {
    return str.length;
  },

  number(str) {
    return !isNaN(Number(str)) ? +str : str;
  }
};

let handleValue: (value: string) => unknown = value => value;

const parseValue = (value: string): unknown => {
  let normalized = value;
  if (
    normalized[0] === normalized[normalized.length - 1] &&
    (normalized[0] === '"' || normalized[0] === "'")
  ) {
    normalized = normalized.substr(1, normalized.length - 2);
  }
  return handleValue(
    normalized
      .replace(new RegExp(aUniqueVerticalStringNotFoundInData, 'g'), segmentSeparateChar)
      .replace(new RegExp(aUniqueCommaStringNotFoundInData, 'g'), argsSeparateChar)
  );
};

export class PowerString {
  _string: unknown;

  constructor(value: unknown) {
    this._string = value;
  }

  toString(): unknown {
    return this._string;
  }
}

function addMethod(method: string, transform: StringTransform): void {
  const prototype = PowerString.prototype as unknown as Record<
    string,
    (this: PowerString, ...args: unknown[]) => PowerString
  >;
  prototype[method] = function dynamicStringTransform(...args: unknown[]): PowerString {
    args.unshift(String(this._string));
    this._string = transform.apply(this, args as [string, ...unknown[]]);
    return this;
  };
}

function importMethods(handles: Record<string, StringTransform>): void {
  for (const method in handles) {
    addMethod(method, handles[method]);
  }
}

importMethods(stringHandles);

function execute(
  current: PowerString | null,
  item: unknown | MethodSegment,
  index: number
): PowerString {
  if (index === 0) {
    return new PowerString(item);
  }
  if (!current || !isMethodSegment(item)) {
    throw new Error('Invalid string transform segment.');
  }
  const method = (current as unknown as Record<
    string,
    (...args: unknown[]) => PowerString
  >)[item.method];
  return method.apply(current, item.args);
}

function isMethodSegment(value: unknown): value is MethodSegment {
  return (
    typeof value === 'object' &&
    value !== null &&
    'method' in value &&
    typeof value.method === 'string' &&
    'args' in value &&
    Array.isArray(value.args)
  );
}

function handleSegment(value: string, index: number): unknown | MethodSegment {
  const normalized = value.trim();
  if (index === 0) {
    return parseValue(normalized);
  }

  let method: string;
  let args: unknown[] = [];
  if (normalized.indexOf(methodAndArgsSeparateChar) > 0) {
    const parts = normalized.split(methodAndArgsSeparateChar);
    method = parts[0].trim();
    args = parts[1].split(argsSeparateChar).map(item => parseValue(item.trim()));
  } else {
    method = normalized;
  }
  if (typeof stringHandles[method] !== 'function') {
    throw new Error(`This method name(${method}) is not exist.`);
  }

  return { method, args };
}

function handleOriginStr(
  value: string,
  handleValueFn?: (value: string) => unknown
): unknown {
  if (!value) return value;
  if (typeof handleValueFn === 'function') {
    handleValue = handleValueFn;
  }
  const result = value
    .replace('\\' + segmentSeparateChar, aUniqueVerticalStringNotFoundInData)
    .replace('\\' + argsSeparateChar, aUniqueCommaStringNotFoundInData)
    .split(segmentSeparateChar)
    .map(handleSegment)
    .reduce<PowerString | null>(execute, null);
  return result?.toString();
}

export const utils = stringHandles;

/**
 * 类似于 angularJs 的 filter 功能。
 */
export const filter = handleOriginStr;
