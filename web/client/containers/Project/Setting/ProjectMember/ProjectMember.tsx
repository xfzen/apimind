import React, { PureComponent as Component } from 'react';
import type { ComponentType } from 'react';
import {
  Table,
  Card,
  Badge,
  Select,
  Button,
  Modal,
  Row,
  Col,
  message,
  Popconfirm,
  Switch,
  Tooltip
} from 'antd';
import PropTypes from 'prop-types';
import Icon from 'client/shims/antdIcon';
import { fetchGroupMsg } from '../../../../reducer/modules/group';
import { connect } from 'react-redux';
import ErrMsg from '../../../../components/ErrMsg/ErrMsg';
import { fetchGroupMemberList } from '../../../../reducer/modules/group';
import {
  fetchProjectList,
  getProjectMemberList,
  getProject,
  addMember,
  delMember,
  changeMemberRole,
  changeMemberEmailNotice
} from '../../../../reducer/modules/project';
import UsernameAutoComplete from '../../../../components/UsernameAutoComplete/UsernameAutoComplete';
import '../Setting.scss';
import { buildApiUrl } from '../../../../utils/backend';
import type { ColumnsType } from 'antd/es/table/interface';
import type { RouteComponentProps } from 'react-router-dom';
import type { ApiResponse } from '../../../../types/api';
import type { RootState } from '../../../../reducer/modules/reducer';
import type { UnknownRecord } from '../../../../reducer/types/runtime';
import { asLegacyClassDecorator } from '../../../../types/legacyDecorators';

const Option = Select.Option;

interface MemberItem extends UnknownRecord { uid: string | number; username?: string; role?: string; email_notice?: boolean; key?: number }
interface ProjectItem extends UnknownRecord { _id: string | number; name?: string }
interface MemberProject extends UnknownRecord { group_id: string | number; role: string; name?: string }
interface AddedMembers extends UnknownRecord { add_members: unknown[]; exist_members: unknown[] }
interface ActionResult<T> { payload: { data: ApiResponse<T> } }
const arrayAddKey = (arr: MemberItem[]): MemberItem[] => {
  return arr.map((item: MemberItem, index: number) => {
    return {
      ...item,
      key: index
    };
  });
};

interface ProjectMemberProps extends RouteComponentProps<{ id: string }> {
  projectId?: number; projectMsg: MemberProject; uid: number; projectList: ProjectItem[];
  addMember: (...args: unknown[]) => Promise<ActionResult<AddedMembers>>;
  delMember: (...args: unknown[]) => Promise<ActionResult<unknown>>;
  changeMemberRole: (...args: unknown[]) => Promise<ActionResult<unknown>>;
  changeMemberEmailNotice: (...args: unknown[]) => Promise<ActionResult<unknown>>;
  getProject: (...args: unknown[]) => Promise<ActionResult<unknown>>;
  fetchGroupMemberList: (...args: unknown[]) => Promise<ActionResult<MemberItem[]>>;
  fetchGroupMsg: (...args: unknown[]) => Promise<ActionResult<{ group_name: string }>>;
  getProjectMemberList: (...args: unknown[]) => Promise<ActionResult<MemberItem[]>>;
  fetchProjectList: (...args: unknown[]) => Promise<ActionResult<unknown>>;
}
interface ProjectMemberState {
  groupMemberList: MemberItem[]; projectMemberList: MemberItem[]; groupName: string; role: string;
  visible: boolean; dataSource: MemberItem[]; inputUids: Array<string | number>; inputRole: string;
  modalVisible: boolean; selectProjectId: string | number;
}
const connectProjectMember = asLegacyClassDecorator(connect(
  (state: RootState) => {
    return {
      projectMsg: state.project.currProject,
      uid: state.user.uid,
      projectList: state.project.projectList
    };
  },
  {
    fetchGroupMemberList,
    getProjectMemberList,
    addMember,
    delMember,
    fetchGroupMsg,
    changeMemberRole,
    getProject,
    fetchProjectList,
    changeMemberEmailNotice
  }
));
@connectProjectMember
class ProjectMember extends Component<ProjectMemberProps, ProjectMemberState> {
  constructor(props: ProjectMemberProps) {
    super(props);
    this.state = {
      groupMemberList: [],
      projectMemberList: [],
      groupName: '',
      role: '',
      visible: false,
      dataSource: [],
      inputUids: [],
      inputRole: 'dev',
      modalVisible: false,
      selectProjectId: 0
    };
  }
  static propTypes = {
    match: PropTypes.object,
    projectId: PropTypes.number,
    projectMsg: PropTypes.object,
    uid: PropTypes.number,
    addMember: PropTypes.func,
    delMember: PropTypes.func,
    changeMemberRole: PropTypes.func,
    getProject: PropTypes.func,
    fetchGroupMemberList: PropTypes.func,
    fetchGroupMsg: PropTypes.func,
    getProjectMemberList: PropTypes.func,
    fetchProjectList: PropTypes.func,
    projectList: PropTypes.array,
    changeMemberEmailNotice: PropTypes.func
  };

  showAddMemberModal = () => {
    this.setState({
      visible: true
    });
  };

  showImportMemberModal = async () => {
    await this.props.fetchProjectList(this.props.projectMsg.group_id);
    this.setState({
      modalVisible: true
    });
  };

  // 重新获取列表

  reFetchList = () => {
    this.props.getProjectMemberList(this.props.match.params.id).then((res: ActionResult<MemberItem[]>) => {
      this.setState({
        projectMemberList: arrayAddKey(res.payload.data.data || []),
        visible: false,
        modalVisible: false
      });
    });
  };

  handleOk = () => {
    this.addMembers(this.state.inputUids);
  };

  // 增 - 添加成员
  addMembers = (memberUids: Array<string | number>) => {
    this.props
      .addMember({
        id: this.props.match.params.id,
        member_uids: memberUids,
        role: this.state.inputRole
      })
      .then((res: ActionResult<AddedMembers>) => {
        if (!res.payload.data.errcode) {
          const { add_members, exist_members } = res.payload.data.data || { add_members: [], exist_members: [] };
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
      const id = this.props.match.params.id;
      this.props.delMember({ id, member_uid }).then((res: ActionResult<unknown>) => {
        if (!res.payload.data.errcode) {
          message.success(res.payload.data.errmsg);
          this.reFetchList(); // 添加成功后重新获取分组成员列表
        }
      });
    };
  };

  // 改 - 修改成员权限
  changeUserRole = (e: string) => {
    const id = this.props.match.params.id;
    const role = e.split('-')[0];
    const member_uid = e.split('-')[1];
    this.props.changeMemberRole({ id, member_uid, role }).then((res: ActionResult<unknown>) => {
      if (!res.payload.data.errcode) {
        message.success(res.payload.data.errmsg);
        this.reFetchList(); // 添加成功后重新获取分组成员列表
      }
    });
  };

  // 修改用户是否接收消息通知
  changeEmailNotice = async (notice: boolean, member_uid: string | number) => {
    const id = this.props.match.params.id;
    await this.props.changeMemberEmailNotice({ id, member_uid, notice });
    this.reFetchList(); // 添加成功后重新获取项目成员列表
  };

  // 关闭模态框
  handleCancel = () => {
    this.setState({
      visible: false
    });
  };
  // 关闭批量导入模态框
  handleModalCancel = () => {
    this.setState({
      modalVisible: false
    });
  };

  // 处理选择项目
  handleChange = (key: string | number) => {
    this.setState({
      selectProjectId: key
    });
  };

  // 确定批量导入模态框
  handleModalOk = async () => {
    // 获取项目中的成员列表
    const menberList = await this.props.getProjectMemberList(this.state.selectProjectId);
    const memberUidList = (menberList.payload.data.data || []).map((item: MemberItem) => {
      return item.uid;
    });
    this.addMembers(memberUidList);
  };

  onUserSelect = (uids: Array<string | number>) => {
    this.setState({
      inputUids: uids
    });
  };

  async componentWillMount() {
    const groupMemberList = await this.props.fetchGroupMemberList(this.props.projectMsg.group_id);
    const groupMsg = await this.props.fetchGroupMsg(this.props.projectMsg.group_id);
    const projectMemberList = await this.props.getProjectMemberList(this.props.match.params.id);
    this.setState({
      groupMemberList: groupMemberList.payload.data.data || [],
      groupName: groupMsg.payload.data.data?.group_name || '',
      projectMemberList: arrayAddKey(projectMemberList.payload.data.data || []),
      role: this.props.projectMsg.role
    });
  }

  render() {
    const isEmailChangeEable = this.state.role === 'owner' || this.state.role === 'admin';
    const columns: ColumnsType<MemberItem> = [
      {
        title:
          this.props.projectMsg.name + ' 项目成员 (' + this.state.projectMemberList.length + ') 人',
        dataIndex: 'username',
        key: 'username',
        render: (text: string, record: MemberItem) => {
          return (
            <div className="m-user">
              <img src={buildApiUrl('/api/user/avatar?uid=' + record.uid)} className="m-user-img" />
              <p className="m-user-name">{text}</p>
              <Tooltip placement="top" title="消息通知">
                <span>
                  <Switch
                    size="small"
                    checkedChildren="开"
                    unCheckedChildren="关"
                    checked={record.email_notice}
                    disabled={!(isEmailChangeEable || record.uid === this.props.uid)}
                    onChange={e => this.changeEmailNotice(e, record.uid)}
                  />
                </span>
              </Tooltip>
            </div>
          );
        }
      },
      {
        title:
          this.state.role === 'owner' || this.state.role === 'admin' ? (
            <div className="btn-container">
              <Button className="btn" type="primary" icon={<Icon type="plus" />} onClick={this.showAddMemberModal}>
                添加成员
              </Button>
              <Button className="btn" icon={<Icon type="plus" />} onClick={this.showImportMemberModal}>
                批量导入成员
              </Button>
            </div>
          ) : (
            ''
          ),
        key: 'action',
        className: 'member-opration',
        render: (_text: unknown, record: MemberItem) => {
          if (this.state.role === 'owner' || this.state.role === 'admin') {
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
    // 获取当前分组下的所有项目名称
    const children = this.props.projectList.map((item: ProjectItem, index: number) => (
      <Option key={index} value={'' + item._id}>
        {item.name}
      </Option>
    ));

    return (
      <div className="g-row">
        <div className="m-panel">
          {this.state.visible ? (
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
                  <div className="label usernamelabel">权限: </div>
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
          <Modal
            title="批量导入成员"
            open={this.state.modalVisible}
            onOk={this.handleModalOk}
            onCancel={this.handleModalCancel}
          >
            <Row gutter={6} className="modal-input">
              <Col span="5">
                <div className="label usernamelabel">项目名: </div>
              </Col>
              <Col span="15">
                <Select
                  showSearch
                  style={{ width: 200 }}
                  placeholder="请选择项目名称"
                  optionFilterProp="children"
                  onChange={this.handleChange}
                >
                  {children}
                </Select>
              </Col>
            </Row>
          </Modal>

          <Table
            columns={columns}
            dataSource={this.state.projectMemberList}
            pagination={false}
            locale={{ emptyText: <ErrMsg type="noMemberInProject" /> }}
            className="setting-project-member"
          />
          <Card
            bordered={false}
            title={
              this.state.groupName + ' 分组成员 ' + '(' + this.state.groupMemberList.length + ') 人'
            }
            hoverable={true}
            className="setting-group"
          >
            {this.state.groupMemberList.length ? (
              this.state.groupMemberList.map((item: MemberItem, index: number) => {
                return (
                  <div key={index} className="card-item">
                    <img src={buildApiUrl('/api/user/avatar?uid=' + item.uid)} className="item-img" />
                    <p className="item-name">
                      {item.username}
                      {item.uid === this.props.uid ? (
                        <Badge
                          count={'我'}
                          style={{
                            backgroundColor: '#689bd0',
                            fontSize: '13px',
                            marginLeft: '8px',
                            borderRadius: '4px'
                          }}
                        />
                      ) : null}
                    </p>
                    {item.role === 'owner' ? <p className="item-role">组长</p> : null}
                    {item.role === 'dev' ? <p className="item-role">开发者</p> : null}
                    {item.role === 'guest' ? <p className="item-role">访客</p> : null}
                  </div>
                );
              })
            ) : (
              <ErrMsg type="noMemberInGroup" />
            )}
          </Card>
        </div>
      </div>
    );
  }
}

export default ProjectMember as unknown as ComponentType<RouteComponentProps<{ id: string }> & { projectId?: number }>;
