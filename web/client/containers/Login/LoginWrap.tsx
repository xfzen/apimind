import React, { PureComponent as Component } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import Tabs from 'antd/es/tabs';

import {
  selectCanRegister,
  selectLoginWrapActiveKey,
  type UserRootState
} from '../../reducer/selectors/user';
import { asLegacyClassDecorator } from '../../types/legacyDecorators';
import LoginForm from './Login';
import RegForm from './Reg';

import './Login.scss';

interface LoginWrapProps {
  form?: unknown;
  loginWrapActiveKey?: string;
  canRegister?: boolean;
}

const mapState = (state: UserRootState) => ({
  loginWrapActiveKey: selectLoginWrapActiveKey(state),
  canRegister: selectCanRegister(state)
});

const connectLoginWrap = asLegacyClassDecorator(connect(mapState));

@connectLoginWrap
export default class LoginWrap extends Component<LoginWrapProps> {
  constructor(props: LoginWrapProps) {
    super(props);
  }

  static propTypes = {
    form: PropTypes.object,
    loginWrapActiveKey: PropTypes.string,
    canRegister: PropTypes.bool
  };

  render() {
    const { loginWrapActiveKey, canRegister } = this.props;
    const items = [
      {
        key: '1',
        label: '登录',
        children: <LoginForm />
      },
      {
        key: '2',
        label: '注册',
        children: canRegister ? (
          <RegForm />
        ) : (
          <div style={{ minHeight: 200 }}>管理员已禁止注册，请联系管理员</div>
        )
      }
    ];
    {
      /** show only login when register is disabled */
    }
    return (
      <Tabs
        defaultActiveKey={loginWrapActiveKey}
        className="login-form"
        tabBarStyle={{ border: 'none' }}
        items={items}
      />
    );
  }
}
