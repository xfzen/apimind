import React, { PureComponent as Component } from 'react';
import type { ComponentType } from 'react';
import PropTypes from 'prop-types';
import { Tabs, Layout } from 'antd';
import { Route, Switch, matchPath } from 'react-router-dom';
import { connect } from 'react-redux';
const { Content, Sider } = Layout;

import './interface.scss';

import InterfaceMenu from './InterfaceList/InterfaceMenu';
import InterfaceList from './InterfaceList/InterfaceList';
import InterfaceContent from './InterfaceList/InterfaceContent';
import DocsInterface from './Docs/DocsInterface';

import InterfaceColMenu from './InterfaceCol/InterfaceColMenu';
import InterfaceColContent from './InterfaceCol/InterfaceColContent';
import InterfaceCaseContent from './InterfaceCol/InterfaceCaseContent';
import { getProject } from '../../../reducer/modules/project';
import { setColData } from '../../../reducer/modules/interfaceCol';
import { LAYOUT } from '../../../constants/variable';
import type { RouteComponentProps } from 'react-router-dom';
import type { RootState } from '../../../reducer/modules/reducer';
import type { InterfaceColState } from '../../../reducer/modules/interfaceCol';
import type { UnknownRecord } from '../../../reducer/types/runtime';
import { asLegacyClassDecorator } from '../../../types/legacyDecorators';
import { selectInterfaceRoute } from './interfaceRoute';
const contentRouter = {
  path: '/project/:id/interface/:action/:actionId',
  exact: true
};

interface InterfaceRouteParams { id: string; action: string; actionId?: string }
interface InterfaceProject extends UnknownRecord { kind?: string }
interface InterfaceProps extends RouteComponentProps<InterfaceRouteParams> {
  isShowCol: boolean;
  curProject: InterfaceProject;
  getProject: (id: string | number) => Promise<unknown>;
  setColData: (data: Partial<InterfaceColState>) => unknown;
}
type InterfaceRouteProps = RouteComponentProps<InterfaceRouteParams>;

const InterfaceRoute = (props: InterfaceRouteProps) => {
  const params = props.match.params;
  const result = selectInterfaceRoute(params.id, params.action, params.actionId);
  if (result.kind === 'redirect') {
    props.history.replace(result.path);
    return null;
  }
  const components: Partial<Record<typeof result.kind, ComponentType<InterfaceRouteProps>>> = {
    list: InterfaceList as unknown as ComponentType<InterfaceRouteProps>,
    content: InterfaceContent as unknown as ComponentType<InterfaceRouteProps>,
    collection: InterfaceColContent as unknown as ComponentType<InterfaceRouteProps>,
    case: InterfaceCaseContent as unknown as ComponentType<InterfaceRouteProps>
  };
  const RouteComponent = components[result.kind] as ComponentType<InterfaceRouteProps>;
  return <RouteComponent {...props} />;
};

InterfaceRoute.propTypes = {
  match: PropTypes.object,
  history: PropTypes.object
};

const connectInterface = asLegacyClassDecorator(connect(
  (state: RootState) => {
    return {
      isShowCol: state.interfaceCol.isShowCol,
      curProject: state.project.currProject
    };
  },
  {
    setColData,
    getProject
  }
));

@connectInterface
class Interface extends Component<InterfaceProps> {
  static propTypes = {
    match: PropTypes.object,
    history: PropTypes.object,
    location: PropTypes.object,
    isShowCol: PropTypes.bool,
    curProject: PropTypes.object,
    getProject: PropTypes.func,
    setColData: PropTypes.func
    // fetchInterfaceColList: PropTypes.func
  };

  constructor(props: InterfaceProps) {
    super(props);
    // this.state = {
    //   curkey: this.props.match.params.action === 'api' ? 'api' : 'colOrCase'
    // }
  }

  onChange = (action: string) => {
    let params = this.props.match.params;
    if (action === 'colOrCase') {
      action = this.props.isShowCol ? 'col' : 'case';
    }
    this.props.history.push('/project/' + params.id + '/interface/' + action);
  };
  async componentWillMount() {
    this.props.setColData({
      isShowCol: true
    });
    // await this.props.fetchInterfaceColList(this.props.match.params.id)
  }
  render() {
    if (this.props.curProject && this.props.curProject.kind === 'docs') {
      return <DocsInterface {...this.props} />;
    }

    const { action } = this.props.match.params;
    // const activeKey = this.state.curkey;
    const activeKey = action === 'api' ? 'api' : 'colOrCase';

    return (
      <Layout style={{ minHeight: LAYOUT.PROJECT_CONTENT_HEIGHT, marginLeft: LAYOUT.PAGE_GAP, marginTop: LAYOUT.PAGE_GAP }}>
        <Sider style={{ height: '100%' }} width={LAYOUT.SIDE_WIDTH}>
          <div className="left-menu">
            <Tabs type="card" className="tabs-large" activeKey={activeKey} onChange={this.onChange}>
              <Tabs.TabPane tab="接口列表" key="api" />
              <Tabs.TabPane tab="测试集合" key="colOrCase" />
            </Tabs>
            {activeKey === 'api' ? (
              React.createElement(InterfaceMenu as unknown as ComponentType<{
                router?: { params: InterfaceRouteParams };
                projectId: string;
              }>, {
                router: matchPath<InterfaceRouteParams>(this.props.location.pathname, contentRouter) || undefined,
                projectId: this.props.match.params.id
              })
            ) : (
              React.createElement(InterfaceColMenu as unknown as ComponentType<{
                router?: { params: InterfaceRouteParams };
                projectId: string;
              }>, {
                router: matchPath<InterfaceRouteParams>(this.props.location.pathname, contentRouter) || undefined,
                projectId: this.props.match.params.id
              })
            )}
          </div>
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
            <div className="right-content">
              <Switch>
                <Route exact path="/project/:id/interface/:action" component={InterfaceRoute} />
                <Route {...contentRouter} component={InterfaceRoute} />
              </Switch>
            </div>
          </Content>
        </Layout>
      </Layout>
    );
  }
}

export default Interface as unknown as ComponentType<RouteComponentProps<InterfaceRouteParams>>;
