import React, { PureComponent as Component } from 'react';
import type { ComponentType, Key } from 'react';
import PropTypes from 'prop-types';
import { Table, Select, Tooltip } from 'antd';
import Icon from 'client/shims/antdIcon';
import variable from '../../../../constants/variable';
import { connect } from 'react-redux';
const Option = Select.Option;
import { fetchInterfaceListMenu } from '../../../../reducer/modules/interface';
import type { ColumnsType, TableRowSelection } from 'antd/es/table/interface';
import type { RootState } from '../../../../reducer/modules/reducer';
import type { UnknownRecord } from '../../../../reducer/types/runtime';
import { asLegacyClassDecorator } from '../../../../types/legacyDecorators';

interface ImportLeaf extends UnknownRecord {
  _id: string | number;
  title?: string;
  path?: string;
  method?: string;
  status?: string;
  key?: Key;
  categoryKey?: string;
  categoryLength?: number;
}
interface ImportCategory extends UnknownRecord { _id: string | number; name: string; list?: ImportLeaf[] }
interface ImportRow extends ImportLeaf { isCategory?: boolean; children: ImportLeaf[] }
interface ImportProject extends UnknownRecord { _id: string | number; name?: string; projectname?: string }
interface ImportInterfaceProps {
  list: ImportCategory[];
  selectInterface: (ids: Key[], projectId: string) => void;
  projectList: ImportProject[];
  currProjectId: string;
  fetchInterfaceListMenu: (projectId: string | number) => Promise<unknown>;
}
interface ImportInterfaceState {
  selectedRowKeys: Key[];
  categoryCount: Record<string, number>;
  project: string;
}
const connectImportInterface = asLegacyClassDecorator(connect(
  (state: RootState) => {
    return {
      projectList: state.project.projectList,
      list: state.inter.list
    };
  },
  {
    fetchInterfaceListMenu
  }
));
@connectImportInterface
class ImportInterface extends Component<ImportInterfaceProps, ImportInterfaceState> {
  constructor(props: ImportInterfaceProps) {
    super(props);
  }

  state: ImportInterfaceState = {
    selectedRowKeys: [],
    categoryCount: {},
    project: this.props.currProjectId
  };

  static propTypes = {
    list: PropTypes.array,
    selectInterface: PropTypes.func,
    projectList: PropTypes.array,
    currProjectId: PropTypes.string,
    fetchInterfaceListMenu: PropTypes.func
  };

  async componentDidMount() {
    // console.log(this.props.currProjectId)
    await this.props.fetchInterfaceListMenu(this.props.currProjectId);
  }

  // 切换项目
  onChange = async (val: string) => {
    this.setState({
      project: val,
      selectedRowKeys: [],
      categoryCount: {}
    });
    await this.props.fetchInterfaceListMenu(val);
  };

  render() {
    const { list, projectList } = this.props;

    // const { selectedRowKeys } = this.state;
    const data: ImportRow[] = list.map((item: ImportCategory) => {
      const children = item.list || [];
      return {
        _id: item._id,
        key: 'category_' + item._id,
        title: item.name,
        isCategory: true,
        children: children.length
          ? children.map((e: ImportLeaf) => {
              e.key = e._id;
              e.categoryKey = 'category_' + item._id;
              e.categoryLength = children.length;
              return e;
            })
          : []
      };
    });
    const self = this;
    const rowSelection: TableRowSelection<ImportRow> = {
      // onChange: (selectedRowKeys) => {
      // console.log(`selectedRowKeys: ${selectedRowKeys}`, 'selectedRows: ', selectedRows);
      // if (selectedRows.isCategory) {
      //   const selectedRowKeys = selectedRows.children.map(item => item._id)
      //   this.setState({ selectedRowKeys })
      // }
      // this.props.onChange(selectedRowKeys.filter(id => ('' + id).indexOf('category') === -1));
      // },
      onSelect: (record: ImportRow, selected: boolean) => {
        // console.log(record, selected, selectedRows);
        const oldSelecteds = self.state.selectedRowKeys;
        const categoryCount = self.state.categoryCount;
        const categoryKey = record.categoryKey || 'category_' + record._id;
        const categoryLength = record.categoryLength || record.children.length;
        let selectedRowKeys: Key[] = [];
        if (record.isCategory) {
          selectedRowKeys = [...record.children.map((item: ImportLeaf) => item._id), record.key ?? record._id];
          if (selected) {
            selectedRowKeys = selectedRowKeys
              .filter((id: Key) => oldSelecteds.indexOf(id) === -1)
              .concat(oldSelecteds);
            categoryCount[categoryKey] = categoryLength;
          } else {
            selectedRowKeys = oldSelecteds.filter((id: Key) => selectedRowKeys.indexOf(id) === -1);
            categoryCount[categoryKey] = 0;
          }
        } else {
          if (selected) {
            selectedRowKeys = [...oldSelecteds, record._id];
            if (categoryCount[categoryKey]) {
              categoryCount[categoryKey] += 1;
            } else {
              categoryCount[categoryKey] = 1;
            }
            if (categoryCount[categoryKey] === record.categoryLength) {
              selectedRowKeys.push(categoryKey);
            }
          } else {
            selectedRowKeys = oldSelecteds.filter((id: Key) => id !== record._id);
            if (categoryCount[categoryKey]) {
              categoryCount[categoryKey] -= 1;
            }
            selectedRowKeys = selectedRowKeys.filter((id: Key) => id !== categoryKey);
          }
        }
        self.setState({ selectedRowKeys, categoryCount });
        self.props.selectInterface(
          selectedRowKeys.filter((id: Key) => ('' + id).indexOf('category') === -1),
          self.state.project
        );
      },
      onSelectAll: (selected: boolean) => {
        // console.log(selected, selectedRows, changeRows);
        let selectedRowKeys: Key[] = [];
        let categoryCount = self.state.categoryCount;
        if (selected) {
          data.forEach((item: ImportRow) => {
            if (item.children) {
              categoryCount['category_' + item._id] = item.children.length;
              selectedRowKeys = [...selectedRowKeys, ...item.children.map((child: ImportLeaf) => child._id)];
            }
          });
          selectedRowKeys = [...selectedRowKeys, ...data.map((item: ImportRow) => item.key ?? item._id)];
        } else {
          categoryCount = {};
          selectedRowKeys = [];
        }
        self.setState({ selectedRowKeys, categoryCount });
        self.props.selectInterface(
          selectedRowKeys.filter((id: Key) => ('' + id).indexOf('category') === -1),
          self.state.project
        );
      },
      selectedRowKeys: self.state.selectedRowKeys
    };

    const columns: ColumnsType<ImportRow> = [
      {
        title: '接口名称',
        dataIndex: 'title',
        width: '30%'
      },
      {
        title: '接口路径',
        dataIndex: 'path',
        width: '40%'
      },
      {
        title: '请求方法',
        dataIndex: 'method',
        render: (item?: string) => {
          const methodKey = (item ? item.toLowerCase() : 'get') as keyof typeof variable.METHOD_COLOR;
          let methodColor = variable.METHOD_COLOR[methodKey] || variable.METHOD_COLOR.get;
          return (
            <span
              style={{
                color: methodColor.color,
                backgroundColor: methodColor.bac,
                borderRadius: 4
              }}
              className="colValue"
            >
              {item}
            </span>
          );
        }
      },
      {
        title: (
          <span>
            状态{' '}
            <Tooltip title="筛选满足条件的接口集合">
              <Icon type="question-circle-o" />
            </Tooltip>
          </span>
        ),
        dataIndex: 'status',
        render: (text?: string) => {
          return (
            text &&
            (text === 'done' ? (
              <span className="tag-status done">已完成</span>
            ) : (
              <span className="tag-status undone">未完成</span>
            ))
          );
        },
        filters: [
          {
            text: '已完成',
            value: 'done'
          },
          {
            text: '未完成',
            value: 'undone'
          }
        ],
        onFilter: (value: boolean | Key, record: ImportRow) => {
          let arr = record.children.filter((item: ImportLeaf) => {
            return (item.status || '').indexOf(String(value)) === 0;
          });
          return arr.length > 0;
          // record.status.indexOf(value) === 0
        }
      }
    ];

    return (
      <div>
        <div className="select-project">
          <span>选择要导入的项目： </span>
          <Select value={this.state.project} style={{ width: 200 }} onChange={this.onChange}>
            {projectList.map((item: ImportProject) => {
              return item.projectname ? (
                ''
              ) : (
                <Option value={`${item._id}`} key={item._id}>
                  {item.name}
                </Option>
              );
            })}
          </Select>
        </div>
        <Table columns={columns} rowSelection={rowSelection} dataSource={data} pagination={false} />
      </div>
    );
  }
}

export default ImportInterface as unknown as ComponentType<Pick<ImportInterfaceProps, 'selectInterface' | 'currProjectId'>>;
