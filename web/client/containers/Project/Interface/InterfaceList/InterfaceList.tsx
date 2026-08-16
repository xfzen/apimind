import React, { PureComponent as Component } from 'react';
import type { ComponentType, Key } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import axios from 'axios';
import { Table, Button, Modal, message, Tooltip, Select } from 'antd';
import Icon from 'client/shims/antdIcon';
import AddInterfaceForm, { type AddInterfaceValues } from './AddInterfaceForm';
import {
  fetchInterfaceListMenu,
  fetchInterfaceList,
  fetchInterfaceCatList
} from '../../../../reducer/modules/interface';
import { getProject } from '../../../../reducer/modules/project';
import { Link } from 'react-router-dom';
import variable from '../../../../constants/variable';
import './Edit.scss';
import Label from '../../../../components/Label/Label';
import type { ColumnsType, FilterValue, SorterResult } from 'antd/es/table/interface';
import type { TablePaginationConfig } from 'antd/es/table';
import type { RouteComponentProps } from 'react-router-dom';
import type { RootState } from '../../../../reducer/modules/reducer';
import type { UnknownRecord } from '../../../../reducer/types/runtime';
import { asLegacyClassDecorator } from '../../../../types/legacyDecorators';

const Option = Select.Option;
const limit = 20;

interface InterfaceListRoute { id: string; actionId?: string }
interface InterfaceCategory extends UnknownRecord { _id: string | number; id?: string | number; name: string; desc?: string }
interface InterfaceTag { name: string }
interface InterfaceRow extends UnknownRecord {
  _id: string | number;
  key: Key;
  project_id: string | number;
  title?: string;
  path?: string;
  method?: string;
  api_opened?: boolean;
  catid?: string | number;
  status: string;
  tag: string[];
}
interface InterfaceProject extends UnknownRecord {
  _id: string | number;
  basepath?: string;
  cat?: InterfaceCategory[];
  tag: InterfaceTag[];
}
interface InterfaceListProps extends RouteComponentProps<InterfaceListRoute> {
  curData: UnknownRecord;
  curProject: InterfaceProject;
  catList: InterfaceCategory[];
  totalTableList: InterfaceRow[];
  catTableList: InterfaceRow[];
  totalCount: number;
  count: number;
  fetchInterfaceListMenu: (id: string | number) => Promise<unknown>;
  fetchInterfaceList: (params: UnknownRecord) => Promise<unknown>;
  fetchInterfaceCatList: (params: UnknownRecord) => Promise<unknown>;
  getProject: (id: string | number) => Promise<unknown>;
}
interface InterfaceListState {
  visible: boolean;
  data: InterfaceRow[];
  filteredInfo: Record<string, FilterValue | null>;
  sortedInfo?: SorterResult<InterfaceRow> | SorterResult<InterfaceRow>[];
  catid: number | null;
  total: number | null;
  current: number;
}
const connectInterfaceList = asLegacyClassDecorator(connect(
  (state: RootState) => {
    return {
      curData: state.inter.curdata,
      curProject: state.project.currProject,
      catList: state.inter.list,
      totalTableList: state.inter.totalTableList,
      catTableList: state.inter.catTableList,
      totalCount: state.inter.totalCount,
      count: state.inter.count
    };
  },
  {
    fetchInterfaceListMenu,
    fetchInterfaceList,
    fetchInterfaceCatList,
    getProject
  }
));
@connectInterfaceList
class InterfaceList extends Component<InterfaceListProps, InterfaceListState> {
  actionId?: string;
  constructor(props: InterfaceListProps) {
    super(props);
    this.state = {
      visible: false,
      data: [],
      filteredInfo: {},
      catid: null,
      total: null,
      current: 1
    };
  }

  static propTypes = {
    curData: PropTypes.object,
    catList: PropTypes.array,
    match: PropTypes.object,
    curProject: PropTypes.object,
    history: PropTypes.object,
    fetchInterfaceListMenu: PropTypes.func,
    fetchInterfaceList: PropTypes.func,
    fetchInterfaceCatList: PropTypes.func,
    totalTableList: PropTypes.array,
    catTableList: PropTypes.array,
    totalCount: PropTypes.number,
    count: PropTypes.number,
    getProject: PropTypes.func
  };

  handleRequest = async (props: InterfaceListProps) => {
    const { params } = props.match;
    if (!params.actionId) {
      let projectId = params.id;
      this.setState({
        catid: null
      });
      let option = {
        page: this.state.current,
        limit,
        project_id: projectId,
        status: this.state.filteredInfo.status,
        tag: this.state.filteredInfo.tag
      };
      await this.props.fetchInterfaceList(option);
    } else if (isNaN(Number(params.actionId))) {
      let catid = params.actionId.substr(4);
      this.setState({catid: +catid});
      let option = {
        page: this.state.current,
        limit,
        catid,
        status: this.state.filteredInfo.status,
        tag: this.state.filteredInfo.tag
      };
      await this.props.fetchInterfaceCatList(option);
    }
  };

  // 更新分类简介
  handleChangeInterfaceCat = (desc: string, name: string) => {
    let params = {
      catid: this.state.catid,
      name: name,
      desc: desc
    };

    axios.post('/api/interface/up_cat', params).then(async res => {
      if (res.data.errcode !== 0) {
        return message.error(res.data.errmsg);
      }
      let project_id = this.props.match.params.id;
      await this.props.getProject(project_id);
      await this.props.fetchInterfaceListMenu(project_id);
      message.success('接口集合简介更新成功');
    });
  };

  handleChange = (
    pagination: TablePaginationConfig,
    filters: Record<string, FilterValue | null>,
    sorter: SorterResult<InterfaceRow> | SorterResult<InterfaceRow>[]
  ) => {
    this.setState({
      current: pagination.current || 1,
      sortedInfo: sorter,
      filteredInfo: filters
    }, () => this.handleRequest(this.props));
  };

  componentWillMount() {
    this.actionId = this.props.match.params.actionId;
    this.handleRequest(this.props);
  }

  componentWillReceiveProps(nextProps: InterfaceListProps) {
    let _actionId = nextProps.match.params.actionId;

    if (this.actionId !== _actionId) {
      this.actionId = _actionId;
      this.setState(
        {
          current: 1
        },
        () => this.handleRequest(nextProps)
      );
    }
  }

  handleAddInterface = (data: AddInterfaceValues) => {
    data.project_id = this.props.curProject._id;
    axios.post('/api/interface/add', data).then(res => {
      if (res.data.errcode !== 0) {
        return message.error(`${res.data.errmsg}, 你可以在左侧的接口列表中对接口进行删改`);
      }
      message.success('接口添加成功');
      let interfaceId = res.data.data._id;
      this.props.history.push('/project/' + data.project_id + '/interface/api/' + interfaceId);
      this.props.fetchInterfaceListMenu(data.project_id as string | number);
    });
  };

  changeInterfaceCat = async (id: string | number, catid: string | number) => {
    const params = {
      id: id,
      catid
    };
    let result = await axios.post('/api/interface/up', params);
    if (result.data.errcode === 0) {
      message.success('修改成功');
      this.handleRequest(this.props);
      this.props.fetchInterfaceListMenu(this.props.curProject._id);
    } else {
      message.error(result.data.errmsg);
    }
  };

  changeInterfaceStatus = async (value: string) => {
    const params = {
      id: value.split('-')[0],
      status: value.split('-')[1]
    };
    let result = await axios.post('/api/interface/up', params);
    if (result.data.errcode === 0) {
      message.success('修改成功');
      this.handleRequest(this.props);
    } else {
      message.error(result.data.errmsg);
    }
  };

  //page change will be processed in handleChange by pagination
  // changePage = current => {
  //   if (this.state.current !== current) {
  //     this.setState(
  //       {
  //         current: current
  //       },
  //       () => this.handleRequest(this.props)
  //     );
  //   }
  // };

  render() {
    let tag = this.props.curProject.tag;
    let tagFilter = tag.map((item: InterfaceTag) => {
      return {text: item.name, value: item.name};
    });

    const columns: ColumnsType<InterfaceRow> = [
      {
        title: '接口名称',
        dataIndex: 'title',
        key: 'title',
        width: '20%',
        render: (text: string, item: InterfaceRow) => {
          return (
            <Link to={'/project/' + item.project_id + '/interface/api/' + item._id}>
              <span className="path">{text}</span>
            </Link>
          );
        }
      },
      {
        title: '接口路径',
        dataIndex: 'path',
        key: 'path',
        width: '34%',
        render: (item: string, record: InterfaceRow) => {
          const path = (this.props.curProject.basepath || '') + item;
          const methodKey = (record.method ? record.method.toLowerCase() : 'get') as keyof typeof variable.METHOD_COLOR;
          let methodColor =
            variable.METHOD_COLOR[methodKey] ||
            variable.METHOD_COLOR['get'];
          return (
            <div>
              <span
                style={{ color: methodColor.color, backgroundColor: methodColor.bac }}
                className="colValue"
              >
                {record.method}
              </span>
              <Tooltip title="开放接口" placement="topLeft">
                <span>{record.api_opened && <Icon className="opened" type="eye-o" />}</span>
              </Tooltip>
              <Tooltip title={path} placement="topLeft" overlayClassName="toolTip">
                <span className="path">{path}</span>
              </Tooltip>
            </div>
          );
        }
      },
      {
        title: '接口分类',
        dataIndex: 'catid',
        key: 'catid',
        width: '20%',
        className: 'interface-cat-column',
        render: (item: string | number, record: InterfaceRow) => {
          return (
            <Select
              value={item + ''}
              className="select interface-cat-select"
              onChange={catid => this.changeInterfaceCat(record._id, catid)}
            >
              {this.props.catList.map((cat: InterfaceCategory) => {
                return (
                  <Option key={cat.id + ''} value={cat._id + ''}>
                    <span>{cat.name}</span>
                  </Option>
                );
              })}
            </Select>
          );
        }
      },
      {
        title: '状态',
        dataIndex: 'status',
        key: 'status',
        width: '14%',
        className: 'interface-status-column',
        render: (text: string, record: InterfaceRow) => {
          const key = record.key;
          return (
            <Select
              value={key + '-' + text}
              className="select"
              onChange={this.changeInterfaceStatus}
            >
              <Option value={key + '-done'}>
                <span className="tag-status done">已完成</span>
              </Option>
              <Option value={key + '-undone'}>
                <span className="tag-status undone">未完成</span>
              </Option>
            </Select>
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
        onFilter: (value: boolean | Key, record: InterfaceRow) => record.status.indexOf(String(value)) === 0
      },
      {
        title: 'tag',
        dataIndex: 'tag',
        key: 'tag',
        width: '12%',
        className: 'interface-tags-column',
        render: (text: string[]) => {
          let textMsg = text.length > 0 ? text.join('，') : '未设置';
          return (
            <Tooltip title={textMsg} placement="topLeft" overlayClassName="toolTip">
              <div className="table-desc">{textMsg}</div>
            </Tooltip>
          );
        },
        filters: tagFilter,
        onFilter: (value: boolean | Key, record: InterfaceRow) => {
          return record.tag.indexOf(String(value)) >= 0;
        }
      }
    ];
    let intername = '',
      desc = '';
    let cat = this.props.curProject ? this.props.curProject.cat : [];

    if (cat) {
      for (let i = 0; i < cat.length; i++) {
        if (cat[i]._id === this.state.catid) {
          intername = cat[i].name;
          desc = cat[i].desc || '';
          break;
        }
      }
    }
    // const data = this.state.data ? this.state.data.map(item => {
    //   item.key = item._id;
    //   return item;
    // }) : [];
    let data: InterfaceRow[] = [];
    let total = 0;
    const { params } = this.props.match;
    if (!params.actionId) {
      data = this.props.totalTableList;
      total = this.props.totalCount;
    } else if (isNaN(Number(params.actionId))) {
      data = this.props.catTableList;
      total = this.props.count;
    }

    data = data.map((item: InterfaceRow) => {
      item.key = item._id;
      return item;
    });

    const pageConfig = {
      total: total,
      pageSize: limit,
      current: this.state.current
      // onChange: this.changePage
    };

    const isDisabled = this.props.catList.length === 0;

    // console.log(this.props.curProject.tag)

    return (
      <div style={{ padding: '24px' }}>
        <h2 className="interface-title" style={{ display: 'inline-block', margin: 0 }}>
          {intername ? intername : '全部接口'}共 ({total}) 个
        </h2>

        <Button
          style={{ float: 'right' }}
          disabled={isDisabled}
          type="primary"
          onClick={() => this.setState({ visible: true })}
        >
          添加接口
        </Button>
        <div style={{ marginTop: '10px' }}>
          <Label onChange={value => this.handleChangeInterfaceCat(value, intername)} desc={desc} />
        </div>
        <Table
          className="table-interfacelist"
          pagination={pageConfig}
          columns={columns}
          onChange={this.handleChange}
          dataSource={data}
        />
        {this.state.visible && (
          <Modal
            title="添加接口"
            open={this.state.visible}
            onCancel={() => this.setState({ visible: false })}
            footer={null}
            className="addcatmodal"
          >
            <AddInterfaceForm
              catid={this.state.catid ?? undefined}
              catdata={cat || []}
              onCancel={() => this.setState({ visible: false })}
              onSubmit={this.handleAddInterface}
            />
          </Modal>
        )}
      </div>
    );
  }
}

export default InterfaceList as unknown as ComponentType<RouteComponentProps<InterfaceListRoute>>;
