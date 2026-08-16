import React, { PureComponent as Component } from 'react';
import PropTypes from 'prop-types';
import type { ChangeEvent, ReactNode } from 'react';
import Icon from 'client/shims/antdIcon';
import { parseSchema, serializeSchema } from './schemaContract.mjs';
import './JsonSchemaEditor.scss';

const TYPES = ['string', 'number', 'integer', 'boolean', 'object', 'array'];

interface JsonSchema {
  type?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  mock?: string | { mock?: string };
  title?: string;
  description?: string;
}

interface JsonSchemaEditorProps {
  data?: string | JsonSchema;
  onChange?: (value: string) => void;
  isMock?: boolean;
}

interface JsonSchemaEditorState {
  schema: JsonSchema;
  expanded: Record<string, boolean>;
}

interface RenderNodeArgs {
  schema: JsonSchema;
  path: string[];
  parentPath: string[];
  name: string;
  level: number;
  required: boolean;
  canDelete: boolean;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value || {}));
}

function safeParseSchema(data?: string | JsonSchema): JsonSchema {
  try {
    const schema = parseSchema(data) as unknown;
    return normalizeSchema(schema && typeof schema === 'object' ? clone(schema as JsonSchema) : {});
  } catch (e) {
    return normalizeSchema({});
  }
}

function normalizeSchema(schema: JsonSchema): JsonSchema {
  if (!schema.type) {
    schema.type = 'object';
  }
  if (schema.type === 'object') {
    if (!schema.properties || typeof schema.properties !== 'object') {
      schema.properties = {};
    }
    if (!Array.isArray(schema.required)) {
      schema.required = [];
    }
  }
  if (schema.type === 'array') {
    if (!schema.items || typeof schema.items !== 'object') {
      schema.items = { type: 'object', properties: {}, required: [] };
    }
    normalizeSchema(schema.items);
  }
  if (schema.type === 'object') {
    const properties = schema.properties || {};
    Object.keys(properties).forEach(key => normalizeSchema(properties[key]));
  }
  return schema;
}

function getMockValue(schema: JsonSchema): string {
  if (!schema.mock) {
    return '';
  }
  if (typeof schema.mock === 'string') {
    return schema.mock;
  }
  return schema.mock.mock || '';
}

function setMockValue(schema: JsonSchema, value: string): void {
  if (!value) {
    delete schema.mock;
    return;
  }
  schema.mock = typeof schema.mock === 'object' ? { ...schema.mock, mock: value } : { mock: value };
}

function pathKey(path: string[]): string {
  return path.length ? path.join('.') : 'root';
}

function walkSchema(schema: JsonSchema, path: string[]): JsonSchema {
  let current = schema;
  path.forEach(part => {
    if (part === 'items') {
      current = current.items!;
    } else {
      current = current.properties![part];
    }
  });
  return current;
}

function childName(index: number): string {
  return `field_${index + 1}`;
}

export default class JsonSchemaEditor extends Component<JsonSchemaEditorProps, JsonSchemaEditorState> {
  static propTypes = {
    data: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
    onChange: PropTypes.func,
    isMock: PropTypes.bool
  };

  lastEmitted = '';

  state: JsonSchemaEditorState = {
    schema: safeParseSchema(this.props.data),
    expanded: { root: true }
  };

  componentDidUpdate(prevProps: JsonSchemaEditorProps) {
    if (prevProps.data !== this.props.data && this.props.data !== this.lastEmitted) {
      this.setState({ schema: safeParseSchema(this.props.data) });
    }
  }

  emitChange(schema: JsonSchema) {
    const normalized = normalizeSchema(schema);
    const text = serializeSchema(normalized);
    this.lastEmitted = text;
    this.setState({ schema: normalized });
    if (this.props.onChange) {
      this.props.onChange(text);
    }
  }

  updateNode(path: string[], updater: (node: JsonSchema, root: JsonSchema) => void) {
    const schema = clone(this.state.schema);
    updater(walkSchema(schema, path), schema);
    this.emitChange(schema);
  }

  toggle(path: string[]) {
    const key = pathKey(path);
    this.setState(prevState => ({
      expanded: {
        ...prevState.expanded,
        [key]: !prevState.expanded[key]
      }
    }));
  }

  addChild(path: string[]) {
    const key = pathKey(path);
    const schema = clone(this.state.schema);
    const node = walkSchema(schema, path);
    if (node.type === 'array') {
      if (!node.items || typeof node.items !== 'object') {
        node.items = { type: 'object', properties: {}, required: [] };
      }
      normalizeSchema(node.items);
    } else {
      node.type = 'object';
      normalizeSchema(node);
    }

    const parent: JsonSchema = node.type === 'array' ? node.items! : node;
    if (parent.type !== 'object') {
      parent.type = 'object';
    }
    normalizeSchema(parent);

    let index = Object.keys(parent.properties!).length;
    let name = childName(index);
    while (parent.properties![name]) {
      index += 1;
      name = childName(index);
    }
    parent.properties![name] = { type: 'string' };

    this.setState(prevState => ({
      expanded: {
        ...prevState.expanded,
        [key]: true
      }
    }));
    this.emitChange(schema);
  }

  deleteChild(path: string[], name: string) {
    const schema = clone(this.state.schema);
    const parent = walkSchema(schema, path);
    if (parent.properties) {
      delete parent.properties[name];
    }
    if (Array.isArray(parent.required)) {
      parent.required = parent.required.filter(item => item !== name);
    }
    this.emitChange(schema);
  }

  renameChild(path: string[], oldName: string, newName: string) {
    const nextName = newName.trim();
    if (!nextName || nextName === oldName) {
      return;
    }
    const schema = clone(this.state.schema);
    const parent = walkSchema(schema, path);
    if (!parent.properties || parent.properties[nextName]) {
      return;
    }
    const keys = Object.keys(parent.properties);
    parent.properties = keys.reduce<Record<string, JsonSchema>>((result, key) => {
      result[key === oldName ? nextName : key] = parent.properties![key];
      return result;
    }, {});
    if (Array.isArray(parent.required)) {
      parent.required = parent.required.map(item => (item === oldName ? nextName : item));
    }
    this.emitChange(schema);
  }

  setRequired(path: string[], name: string, checked: boolean) {
    const schema = clone(this.state.schema);
    const parent = walkSchema(schema, path);
    if (!Array.isArray(parent.required)) {
      parent.required = [];
    }
    if (checked && !parent.required.includes(name)) {
      parent.required.push(name);
    }
    if (!checked) {
      parent.required = parent.required.filter(item => item !== name);
    }
    this.emitChange(schema);
  }

  renderTextField(
    className: string,
    placeholder: string,
    value: string,
    onChange: (event: ChangeEvent<HTMLInputElement>) => void
  ): ReactNode {
    return (
      <span className={'schema-addon-field ' + className + '-group'}>
        <input className={className} placeholder={placeholder} value={value} onChange={onChange} />
        <button type="button" className="schema-addon" tabIndex={-1}>
          <Icon type="edit" />
        </button>
      </span>
    );
  }

  renderRows(parentSchema: JsonSchema, path: string[], level: number): ReactNode {
    if (!parentSchema.properties) {
      return null;
    }
    const properties = parentSchema.properties;
    const names = Object.keys(properties);
    return names.map(name => {
      const child = properties[name];
      return this.renderNode({
        schema: child,
        path: path.concat(name),
        parentPath: path,
        name,
        level,
        required: Array.isArray(parentSchema.required) && parentSchema.required.includes(name),
        canDelete: true
      });
    });
  }

  renderNode({ schema, path, parentPath, name, level, required, canDelete }: RenderNodeArgs): ReactNode {
    const key = pathKey(path);
    const expandable = schema.type === 'object' || schema.type === 'array';
    const childRoot: JsonSchema = schema.type === 'array' ? schema.items || {} : schema;
    const isExpanded = this.state.expanded[key] !== false;

    return (
      <div key={key}>
        <div className="schema-row">
          <span className="schema-name-cell" style={{ paddingLeft: `${level * 18}px` }}>
            <button
              type="button"
              className={'schema-toggle ' + (expandable ? '' : 'is-empty')}
              onClick={() => expandable && this.toggle(path)}
              aria-label={isExpanded ? '收起' : '展开'}
            >
              {expandable ? <Icon type={isExpanded ? 'caret-down' : 'caret-right'} /> : null}
            </button>
            <input
              className="schema-name"
              value={name}
              disabled={!canDelete}
              onChange={e => canDelete && this.renameChild(parentPath, name, e.target.value)}
            />
          </span>
          <input
            type="checkbox"
            className="schema-required"
            checked={!!required}
            disabled={!canDelete}
            onChange={e => this.setRequired(parentPath, name, e.target.checked)}
            title="required"
          />
          <select
            className="schema-type"
            value={schema.type}
            onChange={e =>
              this.updateNode(path, node => {
                node.type = e.target.value;
                if (node.type === 'object') {
                  delete node.items;
                  normalizeSchema(node);
                } else if (node.type === 'array') {
                  delete node.properties;
                  delete node.required;
                  normalizeSchema(node);
                } else {
                  delete node.properties;
                  delete node.required;
                  delete node.items;
                }
              })
            }
          >
            {TYPES.map(type => (
              <option value={type} key={type}>
                {type}
              </option>
            ))}
          </select>
          {this.renderTextField('schema-mock', 'mock', getMockValue(schema), e =>
            this.updateNode(path, node => {
              setMockValue(node, e.target.value);
            })
          )}
          {this.renderTextField('schema-title', 'title', schema.title || '', e =>
            this.updateNode(path, node => {
              if (e.target.value) {
                node.title = e.target.value;
              } else {
                delete node.title;
              }
            })
          )}
          {this.renderTextField('schema-description', 'description', schema.description || '', e =>
            this.updateNode(path, node => {
              if (e.target.value) {
                node.description = e.target.value;
              } else {
                delete node.description;
              }
            })
          )}
          <button type="button" className="schema-icon schema-config">
            <Icon type="setting" />
          </button>
          {canDelete ? (
            <button
              type="button"
              className="schema-icon schema-delete"
              onClick={() => this.deleteChild(parentPath, name)}
            >
              <Icon type="close" />
            </button>
          ) : null}
          <button type="button" className="schema-icon schema-add" onClick={() => this.addChild(path)}>
            <Icon type="plus" />
          </button>
        </div>
        {expandable && isExpanded
          ? this.renderRows(
              childRoot,
              schema.type === 'array' ? path.concat('items') : path,
              level + 1
            )
          : null}
      </div>
    );
  }

  render() {
    const { schema } = this.state;
    return (
      <div className="json-schema-editor">
        {this.renderNode({
          schema,
          path: [],
          parentPath: [],
          name: 'root',
          level: 0,
          required: false,
          canDelete: false
        })}
      </div>
    );
  }
}
