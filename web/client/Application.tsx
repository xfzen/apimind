import React, { PureComponent as Component } from 'react';
import type { ComponentType, ReactNode } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import { Route, BrowserRouter as Router } from 'react-router-dom';
import { Home, Group, Project, Follows, AddProject, Login, Templates } from './containers/index';
import User from './containers/User/User';
import Header from './components/Header/Header';
import Footer from './components/Footer/Footer';
import Loading from './components/Loading/Loading';
import MyPopConfirm from './components/MyPopConfirm/MyPopConfirm';
import { checkLoginState } from './reducer/modules/user';
import { requireAuthentication } from './components/AuthenticatedComponent';
import { renderInto, unmountFrom } from './shims/reactRoot';

import plugin from 'client/plugin';
import type { RouteComponentProps } from 'react-router-dom';
import type { RootState } from './reducer/modules/reducer';
import { asLegacyClassDecorator } from './types/legacyDecorators';

const LOADING_STATUS = 0;

interface AppProps { checkLoginState: () => Promise<unknown>; loginState: number }
interface AppState { login: number }
interface AppRouteConfig {
  path: string;
  component: ComponentType<RouteComponentProps>;
}

let AppRoute: Record<string, AppRouteConfig> = {
  home: {
    path: '/',
    component: Home as unknown as ComponentType<RouteComponentProps>
  },
  group: {
    path: '/group',
    component: Group as unknown as ComponentType<RouteComponentProps>
  },
  project: {
    path: '/project/:id',
    component: Project as unknown as ComponentType<RouteComponentProps>
  },
  user: {
    path: '/user',
    component: User as unknown as ComponentType<RouteComponentProps>
  },
  follow: {
    path: '/follow',
    component: Follows as unknown as ComponentType<RouteComponentProps>
  },
  addProject: {
    path: '/add-project',
    component: AddProject as unknown as ComponentType<RouteComponentProps>
  },
  templates: {
    path: '/templates',
    component: Templates as unknown as ComponentType<RouteComponentProps>
  },
  login: {
    path: '/login',
    component: Login as unknown as ComponentType<RouteComponentProps>
  }
};
// 增加路由钩子
plugin.emitHook('app_route', AppRoute);

const connectApp = asLegacyClassDecorator(connect(
  (state: RootState) => {
    return {
      loginState: state.user.loginState
    };
  },
  {
    checkLoginState
  }
));

@connectApp
class App extends Component<AppProps, AppState> {
  constructor(props: AppProps) {
    super(props);
    this.state = {
      login: LOADING_STATUS
    };
  }

  static propTypes = {
    checkLoginState: PropTypes.func,
    loginState: PropTypes.number
  };

  componentDidMount() {
    this.props.checkLoginState();
  }

  showConfirm = (msg: string, callback: (confirmed: boolean) => void) => {
    // 自定义 window.confirm
    // http://reacttraining.cn/web/api/BrowserRouter/getUserConfirmation-func
    const container = document.createElement('div');
    document.body.appendChild(container);
    const close = (ok: boolean) => {
      callback(ok);
      unmountFrom(container);
      if (container.parentNode) {
        container.parentNode.removeChild(container);
      }
    };
    renderInto(container, <MyPopConfirm msg={msg} callback={close} />);
  };

  route = (status: number): ReactNode => {
    let r: ReactNode;
    if (status === LOADING_STATUS) {
      return <Loading visible />;
    } else {
      r = (
        <Router getUserConfirmation={this.showConfirm}>
          <div className="g-main">
            <div className="router-main">
              {this.props.loginState !== 1
                ? React.createElement(Header as unknown as ComponentType)
                : null}
              <div className="router-container">
                {Object.keys(AppRoute).map(key => {
                  let item = AppRoute[key];
                  return key === 'login' ? (
                    <Route key={key} path={item.path} component={item.component} />
                  ) : key === 'home' ? (
                    <Route key={key} exact path={item.path} component={item.component} />
                  ) : (
                    <Route
                      key={key}
                      path={item.path}
                      component={requireAuthentication(item.component)}
                    />
                  );
                })}
              </div>
              {/* <div className="router-container">
                <Route exact path="/" component={Home} />
                <Route path="/group" component={requireAuthentication(Group)} />
                <Route path="/project/:id" component={requireAuthentication(Project)} />
                <Route path="/user" component={requireAuthentication(User)} />
                <Route path="/follow" component={requireAuthentication(Follows)} />
                <Route path="/add-project" component={requireAuthentication(AddProject)} />
                <Route path="/login" component={Login} />
                {/* <Route path="/statistic" component={statisticsPage} /> */}
              {/* </div> */}
            </div>
            <Footer />
          </div>
        </Router>
      );
    }
    return r;
  };

  render() {
    return this.route(this.props.loginState);
  }
}

export default App as unknown as ComponentType;
