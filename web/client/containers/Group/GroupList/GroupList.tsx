import React, { PureComponent as Component } from 'react';
import type { ChangeEvent, ComponentType } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { Modal, Input, message, Spin, Row, Menu, Col, Popover, Tooltip } from 'antd';
import Icon from 'client/shims/antdIcon';
import { autobind } from 'core-decorators';
import axios from 'axios';
import { withRouter } from 'react-router-dom';
import type { RouteComponentProps } from 'react-router-dom';
const { TextArea } = Input;
const Search = Input.Search;
import UsernameAutoComplete from '../../../components/UsernameAutoComplete/UsernameAutoComplete';
import GuideBtns from '../../../components/GuideBtns/GuideBtns';
import { fetchNewsData } from '../../../reducer/modules/news';
import { fetchGroupList, setCurrGroup, fetchGroupMsg } from '../../../reducer/modules/group';
import _ from 'underscore';
import type { ApiResponse } from '../../../types/api';
import type { RootState } from '../../../reducer/modules/reducer';
import type { GroupRecord } from '../../../reducer/modules/group';
import { asLegacyClassDecorator } from '../../../types/legacyDecorators';

import './GroupList.scss';

interface VisibleGroup extends GroupRecord {
  type?: string;
  hidden?: boolean;
  role?: string;
}
function visibleGroups(groups: VisibleGroup[]): VisibleGroup[] {
  return (groups || []).filter(group => group.type !== 'system' && !group.hidden);
}

const tip = (
  <div className="title-container">
    <h3 className="title">欢迎使用 YApi ~</h3>
    <p>
      这里的 <b>“个人空间”</b>{' '}
      是你自己才能看到的分组，你拥有这个分组的全部权限，可以在这个分组里探索 YApi 的功能。
    </p>
  </div>
);

interface GroupListProps extends RouteComponentProps<{ groupId?: string }> {
  groupList: VisibleGroup[];
  currGroup: VisibleGroup;
  fetchGroupList: () => Promise<unknown>;
  setCurrGroup: (group: Pick<GroupRecord, '_id'>) => unknown;
  curUserRole: string | null;
  curUserRoleInGroup: string;
  studyTip: number;
  study: boolean;
  fetchNewsData: (id: string | number, type: string, page: number, limit?: number, selectValue?: unknown) => unknown;
  fetchGroupMsg: (id: string | number) => unknown;
}
interface GroupListState {
  addGroupModalVisible: boolean;
  newGroupName: string;
  newGroupDesc: string;
  currGroupName: string;
  currGroupDesc: string;
  groupList: VisibleGroup[];
  owner_uids: string[];
  group_name?: string;
}
const connectGroupList = asLegacyClassDecorator(connect(
  (state: RootState) => ({
    groupList: state.group.groupList,
    currGroup: state.group.currGroup,
    curUserRole: state.user.role,
    curUserRoleInGroup: state.group.currGroup.role || state.group.role,
    studyTip: state.user.studyTip,
    study: state.user.study
  }),
  {
    fetchGroupList,
    setCurrGroup,
    fetchNewsData,
    fetchGroupMsg
  }
));
const routeGroupList = asLegacyClassDecorator(withRouter);
@connectGroupList
@routeGroupList
class GroupList extends Component<GroupListProps, GroupListState> {
  static propTypes = {
    groupList: PropTypes.array,
    currGroup: PropTypes.object,
    fetchGroupList: PropTypes.func,
    setCurrGroup: PropTypes.func,
    
    match: PropTypes.object,
    history: PropTypes.object,
    curUserRole: PropTypes.string,
    curUserRoleInGroup: PropTypes.string,
    studyTip: PropTypes.number,
    study: PropTypes.bool,
    fetchNewsData: PropTypes.func,
    fetchGroupMsg: PropTypes.func
  };

  state: GroupListState = {
    addGroupModalVisible: false,
    newGroupName: '',
    newGroupDesc: '',
    currGroupName: '',
    currGroupDesc: '',
    groupList: [],
    owner_uids: []
  };

  constructor(props: GroupListProps) {
    super(props);
  }

  async UNSAFE_componentWillMount() {
    const groupIdParam = this.props.match.params.groupId;
    const groupId = groupIdParam && !isNaN(Number(groupIdParam))
      ? parseInt(groupIdParam)
      : 0;
    await this.props.fetchGroupList();
    const groups = visibleGroups(this.props.groupList);
    let currGroup: VisibleGroup | undefined;
    if (groups.length && groupId) {
      for (let i = 0; i < groups.length; i++) {
        if (groups[i]._id === groupId) {
          currGroup = groups[i];
        }
      }
    } else if (!groupId && groups.length) {
      this.props.history.push(`/group/${groups[0]._id}`);
    }
    if (!currGroup) {
      currGroup = groups[0] || {
        group_name: '',
        group_desc: '',
        custom_field1: { name: '', enable: false }
      };
      if (currGroup._id) {
        this.props.history.replace(`${currGroup._id}`);
      }
    }
    this.setState({ groupList: groups });
    this.props.setCurrGroup(currGroup);
  }

  @autobind
  showModal() {
    this.setState({
      addGroupModalVisible: true
    });
  }
  @autobind
  hideModal() {
    this.setState({
      newGroupName: '',
      group_name: '',
      owner_uids: [],
      addGroupModalVisible: false
    });
  }
  @autobind
  async addGroup() {
    const { newGroupName: group_name, newGroupDesc: group_desc, owner_uids } = this.state;
    const res = await axios.post<ApiResponse<VisibleGroup>>('/api/group/add', { group_name, group_desc, owner_uids });
    if (!res.data.errcode) {
      this.setState({
        newGroupName: '',
        group_name: '',
        owner_uids: [],
        addGroupModalVisible: false
      });
      await this.props.fetchGroupList();
      this.setState({ groupList: visibleGroups(this.props.groupList) });
      const id = this.props.currGroup._id;
      if (id !== undefined) {
        this.props.fetchGroupMsg(id);
        this.props.fetchNewsData(id, 'group', 1, 10);
      }
    } else {
      message.error(res.data.errmsg);
    }
  }
  @autobind
  async editGroup() {
    const { currGroupName: group_name, currGroupDesc: group_desc } = this.state;
    const id = this.props.currGroup._id;
    const res = await axios.post<ApiResponse<VisibleGroup>>('/api/group/up', { group_name, group_desc, id });
    if (res.data.errcode) {
      message.error(res.data.errmsg);
    } else {
      await this.props.fetchGroupList();

      const groups = visibleGroups(this.props.groupList);
      this.setState({ groupList: groups });
      const currGroup = _.find(groups, group => {
        return Number(group._id) === Number(id);
      });

      if (currGroup) this.props.setCurrGroup(currGroup);
      // this.props.setCurrGroup({ group_name, group_desc, _id: id });
      const activeId = this.props.currGroup._id;
      if (activeId !== undefined) {
        this.props.fetchGroupMsg(activeId);
        this.props.fetchNewsData(activeId, 'group', 1, 10);
      }
    }
  }
  @autobind
  inputNewGroupName(e: ChangeEvent<HTMLInputElement>) {
    this.setState({ newGroupName: e.target.value });
  }
  @autobind
  inputNewGroupDesc(e: ChangeEvent<HTMLTextAreaElement>) {
    this.setState({ newGroupDesc: e.target.value });
  }

  @autobind
  selectGroup(e: { key: string }) {
    const groupId = e.key;
    //const currGroup = this.props.groupList.find((group) => { return +group._id === +groupId });
    const currGroup = _.find(this.props.groupList, group => {
      return Number(group._id) === Number(groupId);
    });
    if (!currGroup) return;
    this.props.setCurrGroup(currGroup);
    this.props.history.replace(`${currGroup._id}`);
    this.props.fetchNewsData(groupId, 'group', 1, 10);
  }

  @autobind
  onUserSelect(uids: string[]) {
    this.setState({
      owner_uids: uids
    });
  }

  @autobind
  searchGroup(e: ChangeEvent<HTMLInputElement> | null, value?: string) {
    const v = value || (e ? e.target.value : '');
    const groupList = visibleGroups(this.props.groupList);
    if (v === '') {
      this.setState({ groupList });
    } else {
      this.setState({
        groupList: groupList.filter(group => new RegExp(v, 'i').test(group.group_name))
      });
    }
  }

  UNSAFE_componentWillReceiveProps(nextProps: GroupListProps) {
    // GroupSetting 组件设置的分组信息，通过redux同步到左侧分组菜单中
    if (this.props.groupList !== nextProps.groupList) {
      this.setState({
        groupList: visibleGroups(nextProps.groupList)
      });
    }
  }

  render() {
    const { currGroup } = this.props;
    const menuItems = this.state.groupList.map(group => ({
      key: `${group._id}`,
      className: 'group-item',
      style:
        group.type === 'private'
          ? { zIndex: this.props.studyTip === 0 ? 3 : 1 }
          : undefined,
      icon: <Icon type={group.type === 'private' ? 'user' : 'folder-open'} />,
      label:
        group.type === 'private' ? (
          <Popover
            overlayClassName="popover-index"
            content={<GuideBtns />}
            title={tip}
            placement="right"
            open={this.props.studyTip === 0 && !this.props.study}
          >
            {group.group_name}
          </Popover>
        ) : (
          group.group_name
        )
    }));
    return (
      <div className="m-group">
        {!this.props.study ? <div className="study-mask" /> : null}
        <div className="group-bar">
          <div className="curr-group">
            <div className="curr-group-name">
              <span className="name">{currGroup.group_name}</span>
              <Tooltip title="添加分组">
                <a className="editSet">
                  <Icon className="btn" type="folder-add" onClick={this.showModal} />
                </a>
              </Tooltip>
            
            </div>
            <div className="curr-group-desc">简介: {currGroup.group_desc}</div>
          </div>

          <div className="group-operate">
            <div className="search">
              <Search
                placeholder="搜索分类"
                onChange={this.searchGroup}
                onSearch={v => this.searchGroup(null, v)}
              />
            </div>
          </div>
          {this.state.groupList.length === 0 && <Spin style={{
            marginTop: 20,
            display: 'flex',
            justifyContent: 'center'
          }} />}
          <Menu
            className="group-list"
            mode="inline"
            onClick={this.selectGroup}
            selectedKeys={[`${currGroup._id}`]}
            items={menuItems}
          />
        </div>
        {this.state.addGroupModalVisible ? (
          <Modal
            title="添加分组"
            open={this.state.addGroupModalVisible}
            onOk={this.addGroup}
            onCancel={this.hideModal}
            className="add-group-modal"
          >
            <Row gutter={6} className="modal-input">
              <Col span="5">
                <div className="label">分组名：</div>
              </Col>
              <Col span="15">
                <Input placeholder="请输入分组名称" onChange={this.inputNewGroupName} />
              </Col>
            </Row>
            <Row gutter={6} className="modal-input">
              <Col span="5">
                <div className="label">简介：</div>
              </Col>
              <Col span="15">
                <TextArea rows={3} placeholder="请输入分组描述" onChange={this.inputNewGroupDesc} />
              </Col>
            </Row>
            <Row gutter={6} className="modal-input">
              <Col span="5">
                <div className="label">组长：</div>
              </Col>
              <Col span="15">
                <UsernameAutoComplete callbackState={this.onUserSelect} />
              </Col>
            </Row>
          </Modal>
        ) : (
          ''
        )}
      </div>
    );
  }
}

export default GroupList as unknown as ComponentType;
