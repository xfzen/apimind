import React, { PureComponent as Component } from 'react';
import type { ComponentType } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { Row, Col, Button, Tooltip } from 'antd';
import type { FormInstance } from 'antd';
import { Link, withRouter } from 'react-router-dom';
import type { RouteComponentProps } from 'react-router-dom';
import { addProject, fetchProjectList, delProject } from '../../../reducer/modules/project';
import ProjectCard from '../../../components/ProjectCard/ProjectCard';
import ErrMsg from '../../../components/ErrMsg/ErrMsg';
import { autobind } from 'core-decorators';
import { setBreadcrumb } from '../../../reducer/modules/user';
import type { ProjectData } from '../../../components/ProjectCard/ProjectCard';
import type { BreadcrumbItem } from '../../../types/user';
import type { RootState } from '../../../reducer/modules/reducer';
import type { GroupRecord } from '../../../reducer/modules/group';
import type { UnknownRecord } from '../../../reducer/types/runtime';
import { asLegacyClassDecorator } from '../../../types/legacyDecorators';

import './ProjectList.scss';

interface ProjectListItem extends ProjectData {
  follow?: boolean;
  up_time: number;
  key?: number;
}
interface ProjectListGroup extends GroupRecord {
  type?: string;
  hidden?: boolean;
  role: string;
}
interface ProjectListProps extends RouteComponentProps {
  form: FormInstance;
  fetchProjectList: (id: string | number, page?: number) => unknown;
  addProject: (data: UnknownRecord) => unknown;
  delProject: (id: string | number) => unknown;
  projectList: ProjectListItem[];
  userInfo: UnknownRecord;
  tableLoading: boolean;
  currGroup: ProjectListGroup;
  setBreadcrumb: (data: BreadcrumbItem[]) => unknown;
  currPage: number;
}
interface ProjectListState {
  visible: boolean;
  protocol: string;
  projectData: ProjectListItem[];
}

const connectProjectList = asLegacyClassDecorator(connect(
  (state: RootState) => {
    return {
      projectList: state.project.projectList,
      userInfo: state.project.userInfo,
      tableLoading: state.project.tableLoading,
      currGroup: state.group.currGroup,
      currPage: state.project.currPage
    };
  },
  {
    fetchProjectList,
    addProject,
    delProject,
    setBreadcrumb
  }
));
const routeProjectList = asLegacyClassDecorator(withRouter);

@connectProjectList
@routeProjectList
class ProjectList extends Component<ProjectListProps, ProjectListState> {
  constructor(props: ProjectListProps) {
    super(props);
    this.state = {
      visible: false,
      protocol: 'http://',
      projectData: []
    };
  }
  static propTypes = {
    form: PropTypes.object,
    fetchProjectList: PropTypes.func,
    addProject: PropTypes.func,
    delProject: PropTypes.func,
    projectList: PropTypes.array,
    userInfo: PropTypes.object,
    tableLoading: PropTypes.bool,
    currGroup: PropTypes.object,
    setBreadcrumb: PropTypes.func,
    currPage: PropTypes.number,
    studyTip: PropTypes.number,
    study: PropTypes.bool
  };

  // 取消修改
  @autobind
  handleCancel() {
    this.props.form.resetFields();
    this.setState({
      visible: false
    });
  }

  // 修改线上域名的协议类型 (http/https)
  @autobind
  protocolChange(value: string) {
    this.setState({
      protocol: value
    });
  }

  // 获取 ProjectCard 组件的关注事件回调，收到后更新数据

  receiveRes = () => {
    const id = this.props.currGroup._id;
    if (id !== undefined) this.props.fetchProjectList(id, this.props.currPage);
  };

  UNSAFE_componentWillReceiveProps(nextProps: ProjectListProps) {
    this.props.setBreadcrumb([{ name: '' + (nextProps.currGroup.group_name || '') }]);

    // 切换分组
    if (this.props.currGroup !== nextProps.currGroup && nextProps.currGroup._id) {
      this.props.fetchProjectList(nextProps.currGroup._id, this.props.currPage);
    }

    // 切换项目列表
    if (this.props.projectList !== nextProps.projectList) {
      // console.log(nextProps.projectList);
      const data = nextProps.projectList.map((item, index) => {
        item.key = index;
        return item;
      });
      this.setState({
        projectData: data
      });
    }
  }

  render() {
    let projectData = this.state.projectData;
    let noFollow = [];
    let followProject = [];
    for (var i in projectData) {
      if (projectData[i].follow) {
        followProject.push(projectData[i]);
      } else {
        noFollow.push(projectData[i]);
      }
    }
    followProject = followProject.sort((a, b) => {
      return b.up_time - a.up_time;
    });
    noFollow = noFollow.sort((a, b) => {
      return b.up_time - a.up_time;
    });
    projectData = [...followProject, ...noFollow];

    const isSystemGroup = this.props.currGroup.type === 'system' || this.props.currGroup.hidden;
    const isShow = /(admin)|(owner)|(dev)/.test(this.props.currGroup.role);
    const canManageProjects = isShow && !isSystemGroup;

    const Follow = () => {
      return followProject.length ? (
        <div className="project-section">
          <h3 className="owner-type">我的关注</h3>
          <Row gutter={16}>
            {followProject.map((item, index) => {
              return (
                <Col xs={8} lg={6} xxl={4} key={index}>
                  <ProjectCard projectData={item} callbackResult={this.receiveRes} />
                </Col>
              );
            })}
          </Row>
        </div>
      ) : null;
    };
    const NoFollow = () => {
      return noFollow.length ? (
        <div className="project-section" style={{ borderBottom: '1px solid #eee', marginBottom: '15px' }}>
          <h3 className="owner-type">我的项目</h3>
          <Row gutter={16}>
            {noFollow.map((item, index) => {
              return (
                <Col xs={8} lg={6} xxl={4} key={index}>
                  <ProjectCard
                    projectData={item}
                    callbackResult={this.receiveRes}
                    isShow={canManageProjects}
                  />
                </Col>
              );
            })}
          </Row>
        </div>
      ) : null;
    };

    const OwnerSpace = () => {
      return projectData.length ? (
        <div className="owner-space">
          <NoFollow />
          <Follow />
        </div>
      ) : (
        <ErrMsg type="noProject" />
      );
    };

    return (
      <div style={{ paddingTop: '24px' }} className="m-panel card-panel card-panel-s project-list">
        <Row className="project-list-header">
          <Col span={16} style={{ textAlign: 'left' }}>
            {this.props.currGroup.group_name} 分组共 ({projectData.length}) 个项目
          </Col>
          <Col span={8}>
            {canManageProjects ? (
              <Link to="/add-project">
                <Button type="primary">添加项目</Button>
              </Link>
            ) : isSystemGroup ? (
              <Tooltip title="系统工作区不支持添加普通项目">
                <Button type="primary" disabled>
                  添加项目
                </Button>
              </Tooltip>
            ) : (
              <Tooltip title="您没有权限,请联系该分组组长或管理员">
                <Button type="primary" disabled>
                  添加项目
                </Button>
              </Tooltip>
            )}
          </Col>
        </Row>
        <Row>
          {/* {projectData.length ? projectData.map((item, index) => {
            return (
              <Col xs={8} md={6} xl={4} key={index}>
                <ProjectCard projectData={item} callbackResult={this.receiveRes} />
              </Col>);
          }) : <ErrMsg type="noProject" />} */}
          {this.props.currGroup.type === 'private' ? (
            <OwnerSpace />
          ) : projectData.length ? (
            projectData.map((item, index) => {
              return (
                <Col xs={8} lg={6} xxl={4} key={index}>
                  <ProjectCard
                    projectData={item}
                    callbackResult={this.receiveRes}
                    isShow={isShow}
                  />
                </Col>
              );
            })
          ) : (
            <ErrMsg type="noProject" />
          )}
        </Row>
      </div>
    );
  }
}

export default ProjectList as unknown as ComponentType;
