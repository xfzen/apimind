import React, { Component } from 'react';
import type { ComponentType } from 'react';
import PropTypes from 'prop-types';
import { Tree } from 'antd';
import { connect } from 'react-redux';
import { fetchVariableParamsList } from '../../reducer/modules/interfaceCol';
import type { Key } from 'react';
import type { ApiResponse } from '../../types/api';
import type { RootState } from '../../reducer/modules/reducer';
import { asLegacyClassDecorator } from '../../types/legacyDecorators';

const CanSelectPathPrefix = 'CanSelectPath-';

export function deleteLastObject(str: string): string {
  return str
    .split('.')
    .slice(0, -1)
    .join('.');
}

export function deleteLastArr(str: string): string {
  return str.replace(/\[.*?\]/g, '');
}

interface VariableRecord extends Record<string, unknown> {
  _id: string | number;
  index: number;
  casename?: string;
  params?: unknown;
  body?: unknown;
}

interface VariableTreeNode {
  key: string;
  title: string;
  disabled?: boolean;
  children?: VariableTreeNode[];
}

interface VariablesSelectProps {
  click: (key: string) => void;
  currColId: number;
  fetchVariableParamsList: (id: number) => Promise<{
    payload: { data: ApiResponse<VariableRecord[]> };
  }>;
  clickValue?: string;
  id: string | number;
}

interface VariablesSelectState {
  records: VariableRecord[];
  expandedKeys: Key[];
  selectedKeys: Key[];
}

const connectVariables = asLegacyClassDecorator(connect(
  (state: RootState) => {
    return {
      currColId: state.interfaceCol.currColId
    };
  },
  {
    fetchVariableParamsList
  }
));
@connectVariables
class VariablesSelect extends Component<VariablesSelectProps, VariablesSelectState> {
  static propTypes = {
    click: PropTypes.func,
    currColId: PropTypes.number,
    fetchVariableParamsList: PropTypes.func,
    clickValue: PropTypes.string,
    id: PropTypes.number
  };
  records: VariableRecord[] = [];
  id: string | number | undefined;

  state: VariablesSelectState = {
    records: [],
    expandedKeys: [],
    selectedKeys: []
  };

  handleRecordsData(id: string | number) {
    const newRecords: VariableRecord[] = [];
    this.id = id;
    for (let i = 0; i < this.records.length; i++) {
      if (this.records[i]._id === id) {
        break;
      }
      newRecords.push(this.records[i]);
    }
    this.setState({
      records: newRecords
    });
  }

  async componentDidMount() {
    const { currColId, fetchVariableParamsList, clickValue } = this.props;
    let result = await fetchVariableParamsList(currColId);
    const records = result.payload.data.data || [];
    this.records = records.sort((a, b) => {
      return a.index - b.index;
    });
    this.handleRecordsData(this.props.id);

    if (clickValue) {
      let isArrayParams = clickValue.lastIndexOf(']') === clickValue.length - 1;
      let key = isArrayParams ? deleteLastArr(clickValue) : deleteLastObject(clickValue);
      this.setState({
        expandedKeys: [key],
        selectedKeys: [CanSelectPathPrefix + clickValue]
      });
      // this.props.click(clickValue);
    }
  }

  async componentWillReceiveProps(nextProps: VariablesSelectProps) {
    if (this.records && nextProps.id && this.id !== nextProps.id) {
      this.handleRecordsData(nextProps.id);
    }
  }

  handleSelect = (key: Key) => {
    const stringKey = String(key || '');
    this.setState({
      selectedKeys: [stringKey]
    });
    if (stringKey.indexOf(CanSelectPathPrefix) === 0) {
      this.props.click(stringKey.substr(CanSelectPathPrefix.length));
    } else {
      this.setState({
        expandedKeys: [stringKey]
      });
    }
  };

  onExpand = (keys: Key[]) => {
    this.setState({ expandedKeys: keys });
  };

  render() {
    const pathSelctByTree = (
      data: unknown,
      elementKeyPrefix = '$',
      deepLevel = 0
    ): VariableTreeNode[] => {
      if (!data || typeof data !== 'object') return [];
      let keys = Object.keys(data);
      const source = data as Record<string, unknown>;
      const TreeComponents: VariableTreeNode[] = keys.map((key, index) => {
        let item = source[key];
        let casename: string | undefined;
        if (deepLevel === 0) {
          const record = item as VariableRecord;
          elementKeyPrefix = '$';
          elementKeyPrefix = elementKeyPrefix + '.' + record._id;
          casename = record.casename;
          item = {
            params: record.params,
            body: record.body
          };
        } else if (Array.isArray(data)) {
          elementKeyPrefix =
            index === 0
              ? elementKeyPrefix + '[' + key + ']'
              : deleteLastArr(elementKeyPrefix) + '[' + key + ']';
        } else {
          elementKeyPrefix =
            index === 0
              ? elementKeyPrefix + '.' + key
              : deleteLastObject(elementKeyPrefix) + '.' + key;
        }
        if (item && typeof item === 'object') {
          const isDisable = Array.isArray(item) && item.length === 0;
          return {
            key: elementKeyPrefix,
            disabled: isDisable,
            title: casename || key,
            children: pathSelctByTree(item, elementKeyPrefix, deepLevel + 1)
          };
        }
        return {
          key: CanSelectPathPrefix + elementKeyPrefix,
          title: key
        };
      });

      return TreeComponents;
    };

    const treeData = pathSelctByTree(this.state.records);

    return (
      <div className="modal-postman-form-variable">
        <Tree
          expandedKeys={this.state.expandedKeys}
          selectedKeys={this.state.selectedKeys}
          onSelect={([key]) => this.handleSelect(key || '')}
          onExpand={this.onExpand}
          treeData={treeData}
        />
      </div>
    );
  }
}

export default VariablesSelect as unknown as ComponentType<Pick<
  VariablesSelectProps,
  'click' | 'clickValue' | 'id'
>>;
