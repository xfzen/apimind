import './Header.scss';
import React, { PureComponent as Component } from 'react';
import type { ComponentType, MouseEvent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { Link } from 'react-router-dom';
import { Layout, Dropdown, message, Tooltip, Popover, Tag } from 'antd';
import type { MenuProps, PopoverProps } from 'antd';
import Icon from 'client/shims/antdIcon';
import { checkLoginState, logoutActions, loginTypeAction } from '../../reducer/modules/user';
import { changeMenuItem } from '../../reducer/modules/menu';
import { withRouter } from 'react-router';
import type { RouteComponentProps } from 'react-router';
import Srch from './Search/Search';
const { Header } = Layout;
import LogoSVG from '../LogoSVG';
import Breadcrumb from '../Breadcrumb/Breadcrumb';
import GuideBtns from '../GuideBtns/GuideBtns';
import plugin from 'client/plugin';
import { buildApiUrl } from '../../utils/backend';
import type { ApiResponse } from '../../types/api';
import type { RootState } from '../../reducer/modules/reducer';
import { asLegacyClassDecorator } from '../../types/legacyDecorators';

interface HeaderMenuEntry {
  path: string;
  name: string;
  icon: string;
  adminFlag: boolean;
}
const HeaderMenu: Record<string, HeaderMenuEntry> = {
  user: {
    path: '/user/profile',
    name: '个人中心',
    icon: 'user',
    adminFlag: false
  },
  solution: {
    path: '/user/list',
    name: '用户管理',
    icon: 'solution',
    adminFlag: true
  }
};

plugin.emitHook('header_menu', HeaderMenu);

interface UserMenuProps {
  role: string | null;
  uid: number | null;
  logout: (event: MouseEvent<HTMLAnchorElement>) => void;
}

const getUserMenuItems = (props: UserMenuProps): MenuProps['items'] => {
  const isAdmin = props.role === 'admin';
  const items = Object.keys(HeaderMenu)
    .map(key => {
      let item = HeaderMenu[key];
      if (item.adminFlag && !isAdmin) {
        return null;
      }
      const path = item.name === '个人中心' ? item.path + `/${props.uid}` : item.path;
      return {
        key,
        icon: <Icon type={item.icon} />,
        label: <Link to={path}>{item.name}</Link>
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  items.push({
    key: 'logout',
    icon: <Icon type="logout" />,
    label: (
      <a href="#logout" onClick={props.logout}>
        退出
      </a>
    )
  });
  return items;
};

const tipFollow = (
  <div className="title-container">
    <h3 className="title">
      <Icon type="star" /> 关注
    </h3>
    <p>这里是你的专属收藏夹，便于你找到自己的项目</p>
  </div>
);
const tipAdd = (
  <div className="title-container">
    <h3 className="title">
      <Icon type="plus-circle" /> 新建项目
    </h3>
    <p>在任何页面都可以快速新建项目</p>
  </div>
);
const tipDoc = (
  <div className="title-container">
    <h3 className="title">
      使用文档 <Tag color="orange">推荐!</Tag>
    </h3>
    <p>
      初次使用 YApi，强烈建议你阅读{' '}
      <a target="_blank" href="https://hellosean1025.github.io/yapi/" rel="noopener noreferrer">
        使用文档
      </a>
      ，我们为你提供了通俗易懂的快速入门教程，更有详细的使用说明，欢迎阅读！{' '}
    </p>
  </div>
);

interface ToolUserProps extends UserMenuProps {
  user: string | null;
  msg: string | null;
  studyTip: number;
  study: boolean;
  imageUrl: string;
  relieveLink: () => void;
}
const LegacyPopover = Popover as ComponentType<PopoverProps & { arrowPointAtCenter?: boolean }>;

const ToolUser = (props: ToolUserProps) => {
  let imageUrl = props.imageUrl ? props.imageUrl : buildApiUrl(`/api/user/avatar?uid=${props.uid}`);
  return (
    <ul>
      <li className="toolbar-li item-search">
        <Srch />
      </li>
      <LegacyPopover
        overlayClassName="popover-index"
        content={<GuideBtns />}
        title={tipFollow}
        placement="bottomRight"
        arrowPointAtCenter
        open={props.studyTip === 1 && !props.study}
      >
        <Tooltip placement="bottom" title={'我的关注'}>
          <li className="toolbar-li">
            <Link to="/follow">
              <Icon className="dropdown-link" style={{ fontSize: 16 }} type="star" />
            </Link>
          </li>
        </Tooltip>
      </LegacyPopover>
      <LegacyPopover
        overlayClassName="popover-index"
        content={<GuideBtns />}
        title={tipAdd}
        placement="bottomRight"
        arrowPointAtCenter
        open={props.studyTip === 2 && !props.study}
      >
        <Tooltip placement="bottom" title={'新建项目'}>
          <li className="toolbar-li">
            <Link to="/add-project">
              <Icon className="dropdown-link" style={{ fontSize: 16 }} type="plus-circle" />
            </Link>
          </li>
        </Tooltip>
      </LegacyPopover>
      <LegacyPopover
        overlayClassName="popover-index"
        content={<GuideBtns isLast={true} />}
        title={tipDoc}
        placement="bottomRight"
        arrowPointAtCenter
        open={props.studyTip === 3 && !props.study}
      >
        <Tooltip placement="bottom" title={'使用文档'}>
          <li className="toolbar-li">
            <a target="_blank" href="https://hellosean1025.github.io/yapi" rel="noopener noreferrer">
              <Icon className="dropdown-link" style={{ fontSize: 16 }} type="question-circle" />
            </a>
          </li>
        </Tooltip>
      </LegacyPopover>
      <li className="toolbar-li">
        <Dropdown
          placement="bottomRight"
          trigger={['click']}
          menu={{
            theme: 'dark',
            className: 'user-menu',
            items: getUserMenuItems(props)
          }}
        >
          <a className="dropdown-link" href="#user-menu" onClick={e => e.preventDefault()}>
            <span className="avatar-image">
              <img src={imageUrl} />
            </span>
            {/*props.imageUrl? <Avatar src={props.imageUrl} />: <Avatar src={`/api/user/avatar?uid=${props.uid}`} />*/}
            <span className="name">
              <Icon type="down" />
            </span>
          </a>
        </Dropdown>
      </li>
    </ul>
  );
};
ToolUser.propTypes = {
  user: PropTypes.string,
  msg: PropTypes.string,
  role: PropTypes.string,
  uid: PropTypes.number,
  relieveLink: PropTypes.func,
  logout: PropTypes.func,
  studyTip: PropTypes.number,
  study: PropTypes.bool,
  imageUrl: PropTypes.string
};

type HeaderActionResponse = { payload: { data: ApiResponse<unknown> } };
interface HeaderProps extends RouteComponentProps {
  user: string | null;
  uid: number | null;
  msg: string | null;
  role: string | null;
  login: boolean;
  studyTip: number;
  study: boolean;
  imageUrl: string;
  loginTypeAction: (index: string) => unknown;
  logoutActions: () => Promise<HeaderActionResponse>;
  checkLoginState: Promise<HeaderActionResponse>;
  changeMenuItem: (key: string) => unknown;
}
const connectHeader = asLegacyClassDecorator(connect(
  (state: RootState) => {
    return {
      user: state.user.userName,
      uid: state.user.uid,
      msg: null,
      role: state.user.role,
      login: state.user.isLogin,
      studyTip: state.user.studyTip,
      study: state.user.study,
      imageUrl: state.user.imageUrl
    };
  },
  {
    loginTypeAction,
    logoutActions,
    checkLoginState,
    changeMenuItem
  }
));
const routeHeader = asLegacyClassDecorator(withRouter);
@connectHeader
@routeHeader
export default class HeaderCom extends Component<HeaderProps> {
  constructor(props: HeaderProps) {
    super(props);
  }

  static propTypes = {
    router: PropTypes.object,
    user: PropTypes.string,
    msg: PropTypes.string,
    uid: PropTypes.number,
    role: PropTypes.string,
    login: PropTypes.bool,
    relieveLink: PropTypes.func,
    logoutActions: PropTypes.func,
    checkLoginState: PropTypes.func,
    loginTypeAction: PropTypes.func,
    changeMenuItem: PropTypes.func,
    history: PropTypes.object,
    location: PropTypes.object,
    study: PropTypes.bool,
    studyTip: PropTypes.number,
    imageUrl: PropTypes.string
  };
  linkTo = (e: { key: string }) => {
    if (e.key != '/doc') {
      this.props.changeMenuItem(e.key);
      if (!this.props.login) {
        message.info('请先登录', 1);
      }
    }
  };
  relieveLink = () => {
    this.props.changeMenuItem('');
  };
  logout = (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    this.props
      .logoutActions()
      .then(res => {
        if (res.payload.data.errcode == 0) {
          this.props.history.push('/');
          this.props.changeMenuItem('/');
          message.success('退出成功! ');
        } else {
          message.error(res.payload.data.errmsg);
        }
      })
      .catch((err: unknown) => {
        message.error(String(err));
      });
  };
  handleLogin = (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    this.props.loginTypeAction('1');
  };
  handleReg = (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    this.props.loginTypeAction('2');
  };
  checkLoginState = () => {
    this.props.checkLoginState
      .then(res => {
        if (res.payload.data.errcode !== 0) {
          this.props.history.push('/');
        }
      })
      .catch((err: unknown) => {
        console.log(err);
      });
  };

  render() {
    const { login, user, msg, uid, role, studyTip, study, imageUrl } = this.props;
    return (
      <Header className="header-box m-header">
        <div className="content g-row">
          <Link onClick={this.relieveLink} to="/group" className="logo">
            <div className="href">
              <span className="img">
                <LogoSVG length="28px" />
              </span>
            </div>
          </Link>
          <Breadcrumb />
          <div
            className="user-toolbar"
            style={{ position: 'relative', zIndex: this.props.studyTip > 0 ? 3 : 1 }}
          >
            {login ? (
              <ToolUser
                {...{ studyTip, study, user, msg, uid, role, imageUrl }}
                relieveLink={this.relieveLink}
                logout={this.logout}
              />
            ) : (
              ''
            )}
          </div>
        </div>
      </Header>
    );
  }
}
