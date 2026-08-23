import React, { PureComponent as Component } from 'react';
import type { ComponentType } from 'react';
import { formatTime } from '../../common';
import { Link } from 'react-router-dom';
import { setBreadcrumb } from '../../reducer/modules/user';
//import PropTypes from 'prop-types'
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import { Table, Popconfirm, message, Input } from 'antd';
import type { TableColumnsType } from 'antd';
import axios from 'axios';
import type { ApiResponse } from '../../types/api';
import type { BreadcrumbItem } from '../../types/user';
import type { RootState } from '../../reducer/modules/reducer';
import { asLegacyClassDecorator } from '../../types/legacyDecorators';

const Search = Input.Search;
const limit = 20;
interface UserRow {
  _id: string | number;
  uid?: string | number;
  username: string;
  email: string;
  role: string;
  up_time: string | number;
}
interface UserListApiRow {
  _id?: string | number;
  id?: string | number;
  uid: string | number;
  username: string;
  email: string;
  role: string;
  up_time?: string | number;
  upTime?: string | number;
}
interface UserListPage { list: UserListApiRow[]; count: number }

function normalizeUserRow(item: UserListApiRow): UserRow {
  return {
    _id: item._id ?? item.id ?? item.uid,
    uid: item.uid,
    username: item.username,
    email: item.email,
    role: item.role,
    up_time: formatTime(Number(item.up_time ?? item.upTime ?? 0))
  };
}
interface UserListProps {
  setBreadcrumb: (data: BreadcrumbItem[]) => unknown;
  curUserRole: string | null;
}
interface UserListState {
  data: UserRow[];
  total: number | null;
  current: number;
  backups: UserRow[];
  isSearch: boolean;
}
const connectUserList = asLegacyClassDecorator(connect(
  (state: RootState) => {
    return {
      curUserRole: state.user.role
    };
  },
  {
    setBreadcrumb
  }
));
@connectUserList
class List extends Component<UserListProps, UserListState> {
  constructor(props: UserListProps) {
    super(props);
    this.state = {
      data: [],
      total: null,
      current: 1,
      backups: [],
      isSearch: false
    };
  }
  static propTypes = {
    setBreadcrumb: PropTypes.func,
    curUserRole: PropTypes.string
  };
  changePage = (current: number) => {
    this.setState(
      {
        current: current
      },
      this.getUserList
    );
  };

  getUserList() {
    axios.get<ApiResponse<UserListPage>>('/api/user/list?page=' + this.state.current + '&limit=' + limit).then(res => {
      let result = res.data;

      if (result.errcode === 0 && result.data) {
        const list = result.data.list.map(normalizeUserRow);
        let total = result.data.count;
        this.setState({
          data: list,
          total: total,
          backups: list
        });
      }
    });
  }

  componentDidMount() {
    this.props.setBreadcrumb([{ name: '用户管理' }]);
    this.getUserList();
  }

  confirm = (uid: string | number) => {
    axios
      .post<ApiResponse<null>>('/api/user/del', {
        id: uid
      })
      .then(
        res => {
          if (res.data.errcode === 0) {
            message.success('已删除此用户');
            let userlist = this.state.data;
            userlist = userlist.filter(item => {
              return item._id != uid;
            });
            this.setState({
              data: userlist
            });
          } else {
            message.error(res.data.errmsg);
          }
        },
        err => {
          message.error(err.message);
        }
      );
  };

  handleSearch = (value: string) => {
    let params = { q: value };
    if (params.q !== '') {
      axios.get<ApiResponse<UserListApiRow[]>>('/api/user/search', { params }).then(response => {
        const data = response.data.data;
        const userList = data?.map(normalizeUserRow) ?? [];

        this.setState({
          data: userList,
          isSearch: true
        });
      });
    } else {
      this.setState({
        data: this.state.backups,
        isSearch: false
      });
    }
  };

  render() {
    const role = this.props.curUserRole;
    let data: UserRow[] = [];
    if (role === 'admin') {
      data = this.state.data;
    }
    let columns: TableColumnsType<UserRow> = [
      {
        title: '用户名',
        dataIndex: 'username',
        key: 'username',
        width: 180,
        render: (_username: string, item: UserRow) => {
          return <Link to={'/user/profile/' + item._id}>{item.username}</Link>;
        }
      },
      {
        title: 'Email',
        dataIndex: 'email',
        key: 'email'
      },
      {
        title: '用户角色',
        dataIndex: 'role',
        key: 'role',
        width: 150
      },
      {
        title: '更新日期',
        dataIndex: 'up_time',
        key: 'up_time',
        width: 160
      },
      {
        title: '功能',
        key: 'action',
        width: '90px',
        render: (_value: unknown, item: UserRow) => {
          return (
            <span>
              {/* <span className="ant-divider" /> */}
              <Popconfirm
                title="确认删除此用户?"
                onConfirm={() => {
                  this.confirm(item._id);
                }}
                okText="确定"
                cancelText="取消"
              >
                <a style={{ display: 'block', textAlign: 'center' }} href="#">
                  删除
                </a>
              </Popconfirm>
            </span>
          );
        }
      }
    ];

    columns = columns.filter(item => {
      if (item.key === 'action' && role !== 'admin') {
        return false;
      }
      return true;
    });

    const pageConfig = {
      total: this.state.total ?? undefined,
      pageSize: limit,
      current: this.state.current,
      onChange: this.changePage
    };

    const defaultPageConfig = {
      total: this.state.data.length,
      pageSize: limit,
      current: 1
    };

    return (
      <section className="user-table">
        <div className="user-search-wrapper">
          <h2 style={{ marginBottom: '10px' }}>用户总数：{this.state.total}位</h2>
          <Search
            onChange={e => this.handleSearch(e.target.value)}
            onSearch={this.handleSearch}
            placeholder="请输入用户名"
          />
        </div>
        <Table
          bordered={true}
          rowKey={record => record._id}
          columns={columns}
          pagination={this.state.isSearch ? defaultPageConfig : pageConfig}
          dataSource={data}
        />
      </section>
    );
  }
}

export default List as unknown as ComponentType;
