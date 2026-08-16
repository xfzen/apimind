import React, { Component } from 'react';
import { Table } from 'antd';
import json5 from 'json5';
import PropTypes from 'prop-types';
import { schemaTransformToTable } from '../../../common/schema-transformTo-table.js';
import _ from 'underscore';
import './index.scss';
import type { ReactNode } from 'react';
import type { TableColumnsType } from 'antd';
import type { JsonSchema, SchemaTableRow } from '../../../common/types/schema';

const messageMap: Record<string, string> = {
  desc: '备注',
  default: '实例',
  maximum: '最大值',
  minimum: '最小值',
  maxItems: '最大数量',
  minItems: '最小数量',
  maxLength: '最大长度',
  minLength: '最小长度',
  enum: '枚举',
  enumDesc: '枚举备注',
  uniqueItems: '元素是否都不同',
  itemType: 'item 类型',
  format: 'format',
  itemFormat: 'format',
  mock: 'mock'
};

const columns: TableColumnsType<SchemaTableRow> = [
  {
    title: '名称',
    dataIndex: 'name',
    key: 'name',
    width: 200
  },
  {
    title: '类型',
    dataIndex: 'type',
    key: 'type',
    width: 100,
    render: (text: unknown, item: SchemaTableRow) => {
      // console.log('text',item.sub);
      return text === 'array' ? (
        <span>{(item.sub ? item.sub.itemType || '' : 'array') as ReactNode} []</span>
      ) : (
        <span>{text as ReactNode}</span>
      );
    }
  },
  {
    title: '是否必须',
    dataIndex: 'required',
    key: 'required',
    width: 80,
    render: (text: unknown) => {
      return <div>{text ? '必须' : '非必须'}</div>;
    }
  },
  {
    title: '默认值',
    dataIndex: 'default',
    key: 'default',
    width: 80,
    render: (text: unknown) => {
      return <div>{(_.isBoolean(text) ? text + '' : text) as ReactNode}</div>;
    }
  },
  {
    title: '备注',
    dataIndex: 'desc',
    key: 'desc',
    render: (text: unknown, item: SchemaTableRow) => {
      return _.isUndefined(item.childrenDesc) ? (
        <span className="table-desc">{text as ReactNode}</span>
      ) : (
        <span className="table-desc">{item.childrenDesc as ReactNode}</span>
      );
    }
  },
  {
    title: '其他信息',
    dataIndex: 'sub',
    key: 'sub',
    width: 180,
    render: (text: unknown, record: SchemaTableRow) => {
      const result = (text || record) as Record<string, unknown>;

      return Object.keys(result).map((item, index) => {
        const name = messageMap[item];
        const value = result[item] as { toString(): string };
        const isShow = !_.isUndefined(result[item]) && !_.isUndefined(name);

        return (
          isShow && (
            <p key={index}>
              <span style={{ fontWeight: '700' }}>{name}: </span>
              <span>{value.toString()}</span>
            </p>
          )
        );
      });
    }
  }
];

interface SchemaTableProps {
  dataSource: string;
}

class SchemaTable extends Component<SchemaTableProps> {
  static propTypes = {
    dataSource: PropTypes.string
  };

  constructor(props: SchemaTableProps) {
    super(props);
  }

  render() {
    let product: JsonSchema | null;
    try {
      product = json5.parse(this.props.dataSource) as JsonSchema;
    } catch (e) {
      product = null;
    }
    if (!product) {
      return null;
    }
    let data = schemaTransformToTable(product);
    data = _.isArray(data) ? data : [];
    return <Table bordered size="small" pagination={false} dataSource={data} columns={columns} />;
  }
}
export default SchemaTable;
