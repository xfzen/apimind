import _ from 'underscore';
import type { JsonSchema, SchemaTableRow } from './types/schema';

type SchemaMetadata = Record<string, unknown> & {
  key?: string | number;
  desc?: string;
  default?: unknown;
  children?: SchemaTableRow[];
};

type SchemaResult = SchemaMetadata | SchemaTableRow[];

let fieldNum = 1;

export const schemaTransformToTable = (
  schema: JsonSchema
): SchemaTableRow[] | undefined => {
  try {
    const checkedSchema = checkJsonSchema(schema);
    const result = Schema(checkedSchema, 0);
    return Array.isArray(result) ? result : [result];
  } catch (err) {
    console.log(err);
    return undefined;
  }
};

function checkJsonSchema(json: JsonSchema): JsonSchema {
  const newJson = { ...json };
  if (_.isUndefined(json.type) && _.isObject(json.properties)) {
    newJson.type = 'object';
  }

  return newJson;
}

const mapping = (data: JsonSchema, index: string | number): SchemaResult => {
  switch (data.type) {
    case 'string':
      return SchemaString(data);
    case 'number':
      return SchemaNumber(data);
    case 'array':
      return SchemaArray(data, index);
    case 'object':
      return SchemaObject(data, index);
    case 'boolean':
      return SchemaBoolean(data);
    case 'integer':
      return SchemaInt(data);
    default:
      return SchemaOther(data);
  }
};

const ConcatDesc = (title?: string, desc?: string): string => {
  return [title, desc].join('\n').trim();
};

const Schema = (data: JsonSchema, key: string | number): SchemaTableRow | SchemaTableRow[] => {
  const result = mapping(data, key);
  if (data.type === 'object') {
    return result as SchemaTableRow[];
  }

  const metadata: SchemaMetadata = Array.isArray(result) ? {} : { ...result };
  const desc = metadata.desc;
  const defaultValue = metadata.default;
  const children = metadata.children;

  delete metadata.desc;
  delete metadata.default;
  delete metadata.children;

  const item: SchemaTableRow = {
    type: data.type,
    key,
    desc,
    default: defaultValue,
    sub: metadata
  };

  if (_.isArray(children)) {
    item.children = children;
  }

  return item;
};

const SchemaObject = (data: JsonSchema, key: string | number): SchemaTableRow[] => {
  const properties = data.properties || {};
  const required = data.required || [];
  const result: SchemaTableRow[] = [];

  Object.keys(properties).forEach((name, index) => {
    const value = properties[name];
    const copiedState = checkJsonSchema(JSON.parse(JSON.stringify(value)) as JsonSchema);
    const optionForm = Schema(copiedState, `${key}-${index}`);
    const item: SchemaTableRow = {
      name,
      key: `${key}-${index}`,
      desc: ConcatDesc(copiedState.title, copiedState.description),
      required: required.indexOf(name) !== -1
    };

    if (value.type === 'object' || (_.isUndefined(value.type) && Array.isArray(optionForm))) {
      item.type = 'object';
      item.children = Array.isArray(optionForm) ? optionForm : [optionForm];
      delete item.sub;
    } else if (!Array.isArray(optionForm)) {
      Object.assign(item, optionForm);
    }

    result.push(item);
  });

  return result;
};

const SchemaString = (data: JsonSchema): SchemaMetadata => ({
  desc: ConcatDesc(data.title, data.description),
  default: data.default,
  maxLength: data.maxLength,
  minLength: data.minLength,
  enum: data.enum,
  enumDesc: data.enumDesc,
  format: data.format,
  mock: data.mock && data.mock.mock
});

const SchemaArray = (data: JsonSchema, index: string | number): SchemaMetadata => {
  data.items = data.items || { type: 'string' };
  const items = checkJsonSchema(data.items);
  const optionForm = mapping(items, index);
  let children: SchemaTableRow[];

  if (Array.isArray(optionForm)) {
    children = optionForm;
  } else {
    optionForm.key = `array-${fieldNum++}`;
    children = [optionForm as SchemaTableRow];
  }

  const item: SchemaMetadata = {
    desc: ConcatDesc(data.title, data.description),
    default: data.default,
    minItems: data.minItems,
    uniqueItems: data.uniqueItems,
    maxItems: data.maxItems,
    itemType: items.type,
    children
  };
  if (items.type === 'string') {
    item.itemFormat = items.format;
  }
  return item;
};

const SchemaNumber = (data: JsonSchema): SchemaMetadata => ({
  desc: ConcatDesc(data.title, data.description),
  maximum: data.maximum,
  minimum: data.minimum,
  default: data.default,
  format: data.format,
  enum: data.enum,
  enumDesc: data.enumDesc,
  mock: data.mock && data.mock.mock
});

const SchemaInt = SchemaNumber;

const SchemaBoolean = (data: JsonSchema): SchemaMetadata => ({
  desc: ConcatDesc(data.title, data.description),
  default: data.default,
  enum: data.enum,
  mock: data.mock && data.mock.mock
});

const SchemaOther = (data: JsonSchema): SchemaMetadata => ({
  desc: ConcatDesc(data.title, data.description),
  default: data.default,
  mock: data.mock && data.mock.mock
});
