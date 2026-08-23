import React, { PureComponent as Component } from 'react';
import type { ComponentType } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import { Route, Switch, Redirect, matchPath } from 'react-router-dom';
import { Subnav } from '../../components/index';
import { fetchGroupMsg } from '../../reducer/modules/group';
import { setBreadcrumb } from '../../reducer/modules/user';
import { getProject } from '../../reducer/modules/project';
import Interface from './Interface/Interface';
import Activity from './Activity/Activity';
import Setting from './Setting/Setting';
import Loading from '../../components/Loading/Loading';
import ProjectMember from './Setting/ProjectMember/ProjectMember';
import ProjectData from './Setting/ProjectData/ProjectData';
import TemplateProject from './TemplateProject/TemplateProject';
import WikiPage from 'exts/yapi-plugin-wiki/wikiPage/index';
import plugin from 'client/plugin';
import type { RouteComponentProps } from 'react-router-dom';
import type { RootState } from '../../reducer/modules/reducer';
import type { UnknownRecord } from '../../reducer/types/runtime';
import type { GroupRecord } from '../../reducer/modules/group';
import type { BreadcrumbItem } from '../../types/user';
import { asLegacyClassDecorator } from '../../types/legacyDecorators';

interface ProjectRouteParams { id: string }
interface ProjectRecord extends UnknownRecord {
  group_id: string | number;
  name: string;
  kind?: string;
}
interface CurrentGroup extends GroupRecord { type?: string }
interface ProjectProps extends RouteComponentProps<ProjectRouteParams> {
  curProject: ProjectRecord;
  currGroup: CurrentGroup;
  getProject: (id: string | number) => Promise<unknown>;
  fetchGroupMsg: (id: string | number) => Promise<unknown>;
  setBreadcrumb: (items: BreadcrumbItem[]) => unknown;
}
interface ProjectRouteConfig {
  name: string;
  path: string;
  component: ComponentType<RouteComponentProps<ProjectRouteParams>>;
}
interface SubnavItem { name: string; path: string }

const connectProject = asLegacyClassDecorator(connect(
  (state: RootState) => {
    return {
      curProject: state.project.currProject as ProjectRecord,
      currGroup: state.group.currGroup as CurrentGroup
    };
  },
  {
    getProject,
    fetchGroupMsg,
    setBreadcrumb
  }
));

@connectProject
class Project extends Component<ProjectProps> {
  static propTypes = {
    match: PropTypes.object,
    curProject: PropTypes.object,
    getProject: PropTypes.func,
    location: PropTypes.object,
    fetchGroupMsg: PropTypes.func,
    setBreadcrumb: PropTypes.func,
    currGroup: PropTypes.object
  };

  constructor(props: ProjectProps) {
    super(props);
  }

  async UNSAFE_componentWillMount() {
    await this.props.getProject(this.props.match.params.id);
    await this.props.fetchGroupMsg(this.props.curProject.group_id);

    this.props.setBreadcrumb([
      {
        name: this.props.currGroup.group_name,
        href: '/group/' + this.props.currGroup._id
      },
      {
        name: this.props.curProject.name
      }
    ]);
  }

  async UNSAFE_componentWillReceiveProps(nextProps: ProjectProps) {
    const currProjectId = this.props.match.params.id;
    const nextProjectId = nextProps.match.params.id;
    if (currProjectId !== nextProjectId) {
      await this.props.getProject(nextProjectId);
      await this.props.fetchGroupMsg(this.props.curProject.group_id);
      this.props.setBreadcrumb([
        {
          name: this.props.currGroup.group_name,
          href: '/group/' + this.props.currGroup._id
        },
        {
          name: this.props.curProject.name
        }
      ]);
    }
  }

  render() {
    const { match, location } = this.props;
    let routers: Record<string, ProjectRouteConfig> = {
      interface: { name: '接口', path: '/project/:id/interface/:action', component: Interface as ComponentType<RouteComponentProps<ProjectRouteParams>> },
      activity: { name: '动态', path: '/project/:id/activity', component: Activity as ComponentType<RouteComponentProps<ProjectRouteParams>> },
      wiki: { name: 'Wiki', path: '/project/:id/wiki', component: WikiPage as ComponentType<RouteComponentProps<ProjectRouteParams>> },
      data: { name: '数据管理', path: '/project/:id/data', component: ProjectData as ComponentType<RouteComponentProps<ProjectRouteParams>> },
      members: { name: '成员管理', path: '/project/:id/members', component: ProjectMember as ComponentType<RouteComponentProps<ProjectRouteParams>> },
      setting: { name: '设置', path: '/project/:id/setting', component: Setting as ComponentType<RouteComponentProps<ProjectRouteParams>> }
    };

    plugin.emitHook('sub_nav', routers);

    let key: string;
    let defaultName: string | undefined;
    for (key in routers) {
      if (
        matchPath(location.pathname, {
          path: routers[key].path
        }) !== null
      ) {
        defaultName = routers[key].name;
        break;
      }
    }

    // let subnavData = [{
    //   name: routers.interface.name,
    //   path: `/project/${match.params.id}/interface/api`
    // }, {
    //   name: routers.activity.name,
    //   path: `/project/${match.params.id}/activity`
    // }, {
    //   name: routers.data.name,
    //   path: `/project/${match.params.id}/data`
    // }, {
    //   name: routers.members.name,
    //   path: `/project/${match.params.id}/members`
    // }, {
    //   name: routers.setting.name,
    //   path: `/project/${match.params.id}/setting`
    // }];

    let subnavData: SubnavItem[] = [];
    Object.keys(routers).forEach(key => {
      let item = routers[key];
      let value: SubnavItem;
      if (key === 'interface') {
        value = {
          name: item.name,
          path: `/project/${match.params.id}/interface/api`
        };
      } else {
        value = {
          name: item.name,
          path: item.path.replace(/\:id/gi, match.params.id)
        };
      }
      subnavData.push(value);
    });

    if (this.props.currGroup.type === 'private') {
      subnavData = subnavData.filter(item => {
        return item.name != '成员管理';
      });
    }

    if (this.props.curProject == null || Object.keys(this.props.curProject).length === 0) {
      return <Loading visible />;
    }
    if (this.props.curProject.kind === 'template') {
      return <TemplateProject project={this.props.curProject} />;
    }

    return (
      <div>
        <Subnav default={defaultName as string} data={subnavData} />
        <Switch>
          <Redirect exact from="/project/:id" to={`/project/${match.params.id}/interface/api`} />
          {/* <Route path={routers.activity.path} component={Activity} />
          
          <Route path={routers.setting.path} component={Setting} />
          {this.props.currGroup.type !== 'private' ?
            <Route path={routers.members.path} component={routers.members.component}/>
            : null
          }

          <Route path={routers.data.path} component={ProjectData} /> */}
          {Object.keys(routers).map(key => {
            let item = routers[key];

            return key === 'members' ? (
              this.props.currGroup.type !== 'private' ? (
                <Route path={item.path} component={item.component} key={key} />
              ) : null
            ) : (
              <Route path={item.path} component={item.component} key={key} />
            );
          })}
        </Switch>
      </div>
    );
  }
}

export default Project as unknown as ComponentType<RouteComponentProps<ProjectRouteParams>>;
