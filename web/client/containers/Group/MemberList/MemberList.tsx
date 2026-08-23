import React, { PureComponent as Component } from 'react';
import type { ComponentType } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { Table, Select, Button, Modal, Row, Col, message, Popconfirm } from 'antd';
import type { TableColumnsType } from 'antd';
import Icon from 'client/shims/antdIcon';
import { Link } from 'react-router-dom';
import './MemberList.scss';
import { buildApiUrl } from '../../../utils/backend';
import { autobind } from 'core-decorators';
import {
  fetchGroupMemberList,
  fetchGroupMsg,
  addMember,
  delMember,
  changeMemberRole
} from '../../../reducer/modules/group';
import ErrMsg from '../../../components/ErrMsg/ErrMsg';
import UsernameAutoComplete from '../../../components/UsernameAutoComplete/UsernameAutoComplete';
import type { ApiResponse } from '../../../types/api';
import type { RootState } from '../../../reducer/modules/reducer';
import type { GroupRecord } from '../../../reducer/modules/group';
import type { UnknownRecord } from '../../../reducer/types/runtime';
import { asLegacyClassDecorator } from '../../../types/legacyDecorators';
import {
  EnterpriseMemberNotice,
  withEnterpriseCapabilities,
  type EnterpriseCapabilityProps
} from '../../../components/Enterprise/EnterpriseEntries';
import { areEnterpriseMembersReadOnly } from '../../../services/enterpriseCapabilities';
const Option = Select.Option;

interface GroupMember extends UnknownRecord {
  uid: string | number;
  username: string;
  role: string;
  key?: number;
}
function arrayAddKey(arr: GroupMember[]): GroupMember[] {
  return arr.map((item, index) => {
    return {
      ...item,
      key: index
    };
  });
}

type MemberActionResponse<T = unknown> = { payload: { data: ApiResponse<T> } };
interface MemberListProps extends EnterpriseCapabilityProps {
  currGroup: GroupRecord;
  uid: number | null;
  role: string;
  fetchGroupMemberList: (id: string | number) => Promise<MemberActionResponse<GroupMember[]>>;
  fetchGroupMsg: (id: string | number) => Promise<MemberActionResponse<GroupRecord & { role: string }>>;
  addMember: (data: UnknownRecord) => Promise<MemberActionResponse<{ add_members: unknown[]; exist_members: unknown[] }>>;
  delMember: (data: UnknownRecord) => Promise<MemberActionResponse>;
  changeMemberRole: (data: UnknownRecord) => Promise<MemberActionResponse>;
}
interface MemberListState {
  userInfo: GroupMember[];
  role: string;
  visible: boolean;
  dataSource: unknown[];
  inputUids: string[];
  inputRole: string;
}
const connectMemberList = asLegacyClassDecorator(connect(
  (state: RootState) => {
    return {
      currGroup: state.group.currGroup,
      uid: state.user.uid,
      role: state.group.role
    };
  },
  {
    fetchGroupMemberList,
    fetchGroupMsg,
    addMember,
    delMember,
    changeMemberRole
  }
));
@connectMemberList
class MemberList extends Component<MemberListProps, MemberListState> {
  _groupId: string | number | undefined;

  constructor(props: MemberListProps) {
    super(props);
    this.state = {
      userInfo: [],
      role: '',
      visible: false,
      dataSource: [],
      inputUids: [],
      inputRole: 'dev'
    };
  }
  static propTypes = {
    currGroup: PropTypes.object,
    uid: PropTypes.number,
    fetchGroupMemberList: PropTypes.func,
    fetchGroupMsg: PropTypes.func,
    addMember: PropTypes.func,
    delMember: PropTypes.func,
    changeMemberRole: PropTypes.func,
    role: PropTypes.string
  };

  showAddMemberModal = () => {
    this.setState({
      visible: true
    });
  };

  // 重新获取列表
  reFetchList = () => {
    const id = this.props.currGroup._id;
    if (id === undefined) return;
    this.props.fetchGroupMemberList(id).then(res => {
      this.setState({
        userInfo: arrayAddKey(res.payload.data.data || []),
        visible: false
      });
    });
  };

  // 增 - 添加成员

  handleOk = () => {
    this.props
      .addMember({
        id: this.props.currGroup._id,
        member_uids: this.state.inputUids,
        role: this.state.inputRole
      })
      .then(res => {
        if (!res.payload.data.errcode) {
          const data = res.payload.data.data;
          if (!data) return;
          const { add_members, exist_members } = data;
          const addLength = add_members.length;
          const existLength = exist_members.length;
          this.setState({
            inputRole: 'dev',
            inputUids: []
          });
          message.success(`添加成功! 已成功添加 ${addLength} 人，其中 ${existLength} 人已存在`);
          this.reFetchList(); // 添加成功后重新获取分组成员列表
        }
      });
  };
  // 添加成员时 选择新增成员权限

  changeNewMemberRole = (value: string) => {
    this.setState({
      inputRole: value
    });
  };

  // 删 - 删除分组成员

  deleteConfirm = (member_uid: string | number) => {
    return () => {
      const id = this.props.currGroup._id;
      this.props.delMember({ id, member_uid }).then(res => {
        if (!res.payload.data.errcode) {
          message.success(res.payload.data.errmsg);
          this.reFetchList(); // 添加成功后重新获取分组成员列表
        }
      });
    };
  };

  // 改 - 修改成员权限
  changeUserRole = (e: string) => {
    const id = this.props.currGroup._id;
    const role = e.split('-')[0];
    const member_uid = e.split('-')[1];
    this.props.changeMemberRole({ id, member_uid, role }).then(res => {
      if (!res.payload.data.errcode) {
        message.success(res.payload.data.errmsg);
        this.reFetchList(); // 添加成功后重新获取分组成员列表
      }
    });
  };

  // 关闭模态框

  handleCancel = () => {
    this.setState({
      visible: false
    });
  };

  componentWillReceiveProps(nextProps: MemberListProps) {
    if (this._groupId !== this._groupId) {
      return null;
    }
    if (this.props.currGroup._id !== nextProps.currGroup._id) {
      const nextId = nextProps.currGroup._id;
      if (nextId === undefined) return;
      this.props.fetchGroupMemberList(nextId).then(res => {
        this.setState({
          userInfo: arrayAddKey(res.payload.data.data || [])
        });
      });
      this.props.fetchGroupMsg(nextId).then(res => {
        this.setState({
          role: res.payload.data.data?.role || ''
        });
      });
    }
  }

  componentDidMount() {
    const currGroupId = (this._groupId = this.props.currGroup._id);
    if (currGroupId === undefined) return;
    this.props.fetchGroupMsg(currGroupId).then(res => {
      this.setState({
        role: res.payload.data.data?.role || ''
      });
    });
    this.props.fetchGroupMemberList(currGroupId).then(res => {
      this.setState({
        userInfo: arrayAddKey(res.payload.data.data || [])
      });
    });
  }

  @autobind
  onUserSelect(uids: string[]) {
    this.setState({
      inputUids: uids
    });
  }

  render() {
    const enterpriseManaged = areEnterpriseMembersReadOnly(this.props.enterpriseCapabilities);
    const columns: TableColumnsType<GroupMember> = [
      {
        title:
          this.props.currGroup.group_name + ' 分组成员 (' + this.state.userInfo.length + ') 人',
        dataIndex: 'username',
        key: 'username',
        render: (text: string, record: GroupMember) => {
          return (
            <div className="m-user">
              <Link to={`/user/profile/${record.uid}`}>
                <img src={buildApiUrl('/api/user/avatar?uid=' + record.uid)} className="m-user-img" />
              </Link>
              <Link to={`/user/profile/${record.uid}`}>
                <p className="m-user-name">{text}</p>
              </Link>
            </div>
          );
        }
      },
      {
        title:
          !enterpriseManaged && (this.state.role === 'owner' || this.state.role === 'admin') ? (
            <div className="btn-container">
              <Button className="btn" type="primary" onClick={this.showAddMemberModal}>
                添加成员
              </Button>
            </div>
          ) : (
            ''
          ),
        key: 'action',
        className: 'member-opration',
        render: (_text: unknown, record: GroupMember) => {
          if (!enterpriseManaged && (this.state.role === 'owner' || this.state.role === 'admin')) {
            return (
              <div>
                <Select
                  value={record.role + '-' + record.uid}
                  className="select"
                  onChange={this.changeUserRole}
                >
                  <Option value={'owner-' + record.uid}>组长</Option>
                  <Option value={'dev-' + record.uid}>开发者</Option>
                  <Option value={'guest-' + record.uid}>访客</Option>
                </Select>
                <Popconfirm
                  placement="topRight"
                  title="你确定要删除吗? "
                  onConfirm={this.deleteConfirm(record.uid)}
                  okText="确定"
                  cancelText=""
                >
                  <Button danger icon={<Icon type="delete" />} className="btn-danger" />
                  {/* <Icon type="delete" className="btn-danger"/> */}
                </Popconfirm>
              </div>
            );
          } else {
            // 非管理员可以看到权限 但无法修改
            if (record.role === 'owner') {
              return '组长';
            } else if (record.role === 'dev') {
              return '开发者';
            } else if (record.role === 'guest') {
              return '访客';
            } else {
              return '';
            }
          }
        }
      }
    ];
    let userinfo = this.state.userInfo;
    const ownerinfo: GroupMember[] = [];
    const devinfo: GroupMember[] = [];
    const guestinfo: GroupMember[] = [];
    for (let i = 0; i < userinfo.length; i++) {
      if (userinfo[i].role === 'owner') {
        ownerinfo.push(userinfo[i]);
      }
      if (userinfo[i].role === 'dev') {
        devinfo.push(userinfo[i]);
      }
      if (userinfo[i].role === 'guest') {
        guestinfo.push(userinfo[i]);
      }
    }
    userinfo = [...ownerinfo, ...devinfo, ...guestinfo];
    return (
      <div className="m-panel">
        <EnterpriseMemberNotice capabilities={this.props.enterpriseCapabilities} />
        {!enterpriseManaged && this.state.visible ? (
          <Modal
            title="添加成员"
            open={this.state.visible}
            onOk={this.handleOk}
            onCancel={this.handleCancel}
          >
            <Row gutter={6} className="modal-input">
              <Col span="5">
                <div className="label usernamelabel">用户名: </div>
              </Col>
              <Col span="15">
                <UsernameAutoComplete callbackState={this.onUserSelect} />
              </Col>
            </Row>
            <Row gutter={6} className="modal-input">
              <Col span="5">
                <div className="label usernameauth">权限: </div>
              </Col>
              <Col span="15">
                <Select defaultValue="dev" className="select" onChange={this.changeNewMemberRole}>
                  <Option value="owner">组长</Option>
                  <Option value="dev">开发者</Option>
                  <Option value="guest">访客</Option>
                </Select>
              </Col>
            </Row>
          </Modal>
        ) : (
          ''
        )}
        <Table
          columns={columns}
          dataSource={userinfo}
          pagination={false}
          locale={{ emptyText: <ErrMsg type="noMemberInGroup" /> }}
        />
      </div>
    );
  }
}

export default withEnterpriseCapabilities(
  MemberList as unknown as ComponentType<MemberListProps>
) as unknown as ComponentType;
