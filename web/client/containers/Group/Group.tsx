import React, { PureComponent as Component } from 'react';
import GroupList from './GroupList/GroupList';
import ProjectList from './ProjectList/ProjectList';
import MemberList from './MemberList/MemberList';
import GroupLog from './GroupLog/GroupLog';
import GroupSetting from './GroupSetting/GroupSetting';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { Route, Switch, Redirect } from 'react-router-dom';
import { Tabs, Layout, Spin } from 'antd';
const { Content, Sider } = Layout;
import { fetchNewsData } from '../../reducer/modules/news';
import {
  setCurrGroup
} from '../../reducer/modules/group';
import './Group.scss';
import axios from 'axios'
import { LAYOUT } from '../../constants/variable.js';
import type { ApiResponse } from '../../types/api';
import type { RootState } from '../../reducer/modules/reducer';
import type { GroupRecord } from '../../reducer/modules/group';
import { asLegacyClassDecorator } from '../../types/legacyDecorators';

interface ActiveGroup extends GroupRecord {
  type?: string;
  role?: string;
}
interface GroupProps {
  curGroupId?: string | number;
  curUserRole: string | null;
  curUserRoleInGroup: string;
  currGroup: ActiveGroup;
  setCurrGroup: (group: Pick<GroupRecord, '_id'>) => unknown;
}
interface GroupState { groupId: string | number }

const connectGroup = asLegacyClassDecorator(connect(
  (state: RootState) => {
    return {
      curGroupId: state.group.currGroup._id,
      curUserRole: state.user.role,
      curUserRoleInGroup: state.group.currGroup.role || state.group.role,
      currGroup: state.group.currGroup
    };
  },
  {
    fetchNewsData: fetchNewsData,
    setCurrGroup
  }
));
@connectGroup
export default class Group extends Component<GroupProps, GroupState> {
  constructor(props: GroupProps) {
    super(props);

    this.state = {
      groupId: -1
    }
  }

  async componentDidMount(){
    const r = await axios.get<ApiResponse<ActiveGroup>>('/api/group/get_mygroup')
    try{
      const group = r.data.data;
      if (!group || group._id === undefined) return;
      this.setState({
        groupId: group._id
      })
      this.props.setCurrGroup(group)
    }catch(e){
      console.error(e)
    }
  }

  static propTypes = {
    fetchNewsData: PropTypes.func,
    curGroupId: PropTypes.number,
    curUserRole: PropTypes.string,
    currGroup: PropTypes.object,
    curUserRoleInGroup: PropTypes.string,
    setCurrGroup: PropTypes.func
  };
  // onTabClick=(key)=> {
  //   // if (key == 3) {
  //   //   this.props.fetchNewsData(this.props.curGroupId, "group", 1, 10)
  //   // }
  // }
  render() {
    if(this.state.groupId === -1)return <Spin />
    const tabItems = [
      {
        key: '1',
        label: '项目列表',
        children: <ProjectList />
      }
    ];
    if (this.props.currGroup.type === 'public') {
      tabItems.push({ key: '2', label: '成员列表', children: <MemberList /> });
    }
    if (
      ['admin', 'owner', 'guest', 'dev'].indexOf(this.props.curUserRoleInGroup) > -1 ||
      this.props.curUserRole === 'admin'
    ) {
      tabItems.push({ key: '3', label: '分组动态', children: <GroupLog /> });
    }
    if (
      (this.props.curUserRole === 'admin' || this.props.curUserRoleInGroup === 'owner') &&
      this.props.currGroup.type !== 'private'
    ) {
      tabItems.push({ key: '4', label: '分组设置', children: <GroupSetting /> });
    }
    const GroupContent = (
      <Layout style={{ minHeight: LAYOUT.GROUP_CONTENT_HEIGHT, marginLeft: LAYOUT.PAGE_GAP, marginTop: LAYOUT.PAGE_GAP }}>
        <Sider style={{ height: '100%' }} width={LAYOUT.SIDE_WIDTH}>
          <div className="logo" />
          <GroupList />
        </Sider>
        <Layout>
          <Content
            style={{
              height: '100%',
              margin: '0 16px 0 12px',
              overflow: 'initial',
              backgroundColor: '#fff'
            }}
          >
            <Tabs
              type="card"
              className="m-tab tabs-large"
              style={{ height: '100%' }}
              items={tabItems}
            />
          </Content>
        </Layout>
      </Layout>
    );
    return (
      <div className="projectGround">
        <Switch>
          <Redirect exact from="/group" to={"/group/" + this.state.groupId} />
          <Route path="/group/:groupId" render={() => GroupContent} />
        </Switch>
      </div>
    );
  }
}
