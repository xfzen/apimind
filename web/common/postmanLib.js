import * as constants from '../client/constants/variable.js';
import _ from 'underscore';

const HTTP_METHOD = constants.HTTP_METHOD;
const ContentTypeMap = {
  'application/json': 'json',
  'application/xml': 'xml',
  'text/xml': 'xml',
  'application/html': 'html',
  'text/html': 'html',
  other: 'text'
};

function handleContentType(headers) {
  if (!headers || typeof headers !== 'object') return ContentTypeMap.other;
  let contentTypeItem = 'other';
  try {
    Object.keys(headers).forEach(key => {
      if (/content-type/i.test(key)) {
        contentTypeItem = headers[key]
          .split(';')[0]
          .trim()
          .toLowerCase();
      }
    });
    return ContentTypeMap[contentTypeItem] ? ContentTypeMap[contentTypeItem] : ContentTypeMap.other;
  } catch (err) {
    return ContentTypeMap.other;
  }
}

function checkRequestBodyIsRaw(method, reqBodyType) {
  if (
    reqBodyType &&
    reqBodyType !== 'file' &&
    reqBodyType !== 'form' &&
    HTTP_METHOD[method].request_body
  ) {
    return reqBodyType;
  }
  return false;
}

function checkNameIsExistInArray(name, arr) {
  for (let i = 0; i < arr.length; i++) {
    if (arr[i].name === name) {
      return true;
    }
  }
  return false;
}

function handleCurrDomain(domains, caseEnv) {
  return _.find(domains, item => item.name === caseEnv) || domains[0];
}

export {
  checkRequestBodyIsRaw,
  handleContentType,
  handleCurrDomain,
  checkNameIsExistInArray
};
