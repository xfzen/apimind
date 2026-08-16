/**
 * @author suxiaoxin
 * @info mockJs 功能增强脚本
 */

import Mock from '@apimind/mockjs-safe';

type UnknownRecord = Record<string, unknown>;
type MutableContainer = UnknownRecord | unknown[];

interface MockRuntime {
  Random: {
    extend(methods: Record<string, () => unknown>): void;
  };
}

const strRegex = /\${([a-zA-Z]+)\.?([a-zA-Z0-9_\.]*)\}/i;
const varSplit = '.';
const mockSplit = '|';
const mockRuntime = Mock as unknown as MockRuntime;

mockRuntime.Random.extend({
  timestamp() {
    const time = new Date().getTime() + '';
    return +time.substr(0, time.length - 3);
  }
});

function isContainer(value: unknown): value is MutableContainer {
  return typeof value === 'object' && value !== null;
}

function read(container: MutableContainer, key: string): unknown {
  return Array.isArray(container) ? container[Number(key)] : container[key];
}

function write(container: MutableContainer, key: string, value: unknown): void {
  if (Array.isArray(container)) {
    container[Number(key)] = value;
  } else {
    container[key] = value;
  }
}

function hasKey(container: MutableContainer, key: string): boolean {
  return key in container;
}

function mock(mockJSON: unknown, context: UnknownRecord = {}): unknown {
  const filtersMap: Record<string, (item: string) => unknown> = {
    regexp: item => new RegExp(item)
  };

  if (!isContainer(mockJSON)) {
    return mockJSON;
  }

  return parse(mockJSON);

  function parse(source: MutableContainer, output?: MutableContainer): MutableContainer {
    const result = output || (Array.isArray(source) ? [] : {});

    for (const key of Object.keys(source)) {
      if (!Object.prototype.hasOwnProperty.call(source, key)) {
        continue;
      }
      const value = read(source, key);
      if (isContainer(value)) {
        const child: MutableContainer = Array.isArray(value) ? [] : {};
        write(result, key, child);
        parse(value, child);
      } else if (value && typeof value === 'string') {
        const transformed = handleStr(value);
        write(source, key, transformed);
        const filters = key.split(mockSplit);
        const newFilters = [...filters];
        write(result, key, transformed);
        if (filters.length > 1) {
          for (let index = 1; index < filters.length; index++) {
            const filterName = filters[index].toLowerCase();
            const filter = filtersMap[filterName];
            if (filter) {
              const position = newFilters.indexOf(filterName);
              if (position !== -1) {
                newFilters.splice(position, 1);
              }
              if (Array.isArray(result)) {
                delete result[Number(key)];
              } else {
                delete result[key];
              }
              write(result, newFilters.join(mockSplit), filter(String(transformed)));
            }
          }
        }
      } else {
        write(result, key, value);
      }
    }
    return result;
  }

  function handleStr(value: string): unknown {
    if (
      value.indexOf('{') === -1 ||
      value.indexOf('}') === -1 ||
      value.indexOf('$') === -1
    ) {
      return value;
    }

    const matches = value.match(strRegex);
    if (!matches) return value;

    const name = matches[1] + (matches[2] ? '.' + matches[2] : '');
    if (!name) return value;
    const names = name.split(varSplit);
    let data: unknown = context;

    names.forEach(part => {
      if (data === '') return;
      if (isContainer(data) && hasKey(data, part)) {
        data = read(data, part);
      } else {
        data = '';
      }
    });
    return data;
  }
}

export default mock;
