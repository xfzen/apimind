import React, { PureComponent as Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import type { FormInstance, RadioChangeEvent } from 'antd';
import Button from 'antd/es/button';
import Form from 'antd/es/form';
import Input from 'antd/es/input';
import message from 'antd/es/message';
import Radio from 'antd/es/radio';
import type { RouteComponentProps } from 'react-router';
import { withRouter } from 'react-router';
import Icon from 'client/shims/antdIcon';
import { emailRule as safeEmailRule } from 'common/validators.js';

import type { AppDispatch, ResolvedPromiseAction } from '../../reducer/promiseTypes';
import { loginActions, loginLdapActions } from '../../reducer/modules/user';
import {
  selectIsLdap,
  selectUser,
  type UserRootState
} from '../../reducer/selectors/user';
import type { LoginCredentials, LoginResponse, UserState } from '../../types/user';
import { asLegacyClassDecorator } from '../../types/legacyDecorators';

import './Login.scss';

const FormItem = Form.Item;
const RadioGroup = Radio.Group;

const formItemStyle = {
  marginBottom: '.16rem'
};

const changeHeight = {
  height: '.42rem'
};

type LoginDispatchResult = Promise<ResolvedPromiseAction<LoginResponse>>;

interface LoginProps {
  form: FormInstance<LoginCredentials>;
  history?: RouteComponentProps['history'];
  loginActions?: (values: LoginCredentials) => LoginDispatchResult;
  loginLdapActions?: (values: LoginCredentials) => LoginDispatchResult;
  loginData?: UserState;
  isLDAP?: boolean;
}

interface LoginState {
  loginType: 'ldap' | 'normal';
}

function hasPreventDefault(value: unknown): value is { preventDefault: () => void } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'preventDefault' in value &&
    typeof value.preventDefault === 'function'
  );
}

const mapState = (state: UserRootState) => ({
  loginData: selectUser(state),
  isLDAP: selectIsLdap(state)
});

const mapDispatch = (dispatch: AppDispatch) => ({
  loginActions: (values: LoginCredentials) => dispatch(loginActions(values)),
  loginLdapActions: (values: LoginCredentials) => dispatch(loginLdapActions(values))
});

const connectLogin = asLegacyClassDecorator(connect(mapState, mapDispatch));
const routeLogin = asLegacyClassDecorator(withRouter);

@connectLogin
@routeLogin
class Login extends Component<LoginProps, LoginState> {
  constructor(props: LoginProps) {
    super(props);
    this.state = {
      loginType: 'ldap'
    };
  }

  static propTypes = {
    form: PropTypes.object,
    history: PropTypes.object,
    loginActions: PropTypes.func,
    loginLdapActions: PropTypes.func,
    isLDAP: PropTypes.bool
  };

  handleSubmit = (event: unknown) => {
    if (hasPreventDefault(event)) {
      event.preventDefault();
    }
    this.props.form
      .validateFields()
      .then(values => {
        if (this.props.isLDAP && this.state.loginType === 'ldap') {
          return this.props.loginLdapActions!(values).then(res => {
            if (res.payload.data.errcode === 0) {
              this.props.history!.replace('/group');
              message.success('登录成功! ');
            }
          });
        }

        return this.props.loginActions!(values).then(res => {
          if (res.payload.data.errcode === 0) {
            this.props.history!.replace('/group');
            message.success('登录成功! ');
          }
        });
      })
      .catch(() => {});
  };

  componentDidMount() {
    //Qsso.attach('qsso-login','/api/user/login_by_token')
    console.log('isLDAP', this.props.isLDAP);
  }

  handleFormLayoutChange = (event: RadioChangeEvent) => {
    this.setState({ loginType: event.target.value });
  };

  render() {
    const { isLDAP } = this.props;

    const emailRule =
      this.state.loginType === 'ldap'
        ? {}
        : {
            required: true,
            message: '请输入正确的email!',
            ...safeEmailRule('请输入正确的email!')
          };
    return (
      <Form form={this.props.form} onFinish={this.handleSubmit}>
        {/* 登录类型 (普通登录／LDAP登录) */}
        {isLDAP && (
          <FormItem>
            <RadioGroup defaultValue="ldap" onChange={this.handleFormLayoutChange}>
              <Radio value="ldap">LDAP</Radio>
              <Radio value="normal">普通登录</Radio>
            </RadioGroup>
          </FormItem>
        )}
        {/* 用户名 (Email) */}
        <FormItem style={formItemStyle} name="email" rules={[emailRule]}>
          <Input
            style={changeHeight}
            prefix={<Icon type="user" style={{ fontSize: 13 }} />}
            placeholder="Email"
          />
        </FormItem>

        {/* 密码 */}
        <FormItem
          style={formItemStyle}
          name="password"
          rules={[{ required: true, message: '请输入密码!' }]}
        >
          <Input
            style={changeHeight}
            prefix={<Icon type="lock" style={{ fontSize: 13 }} />}
            type="password"
            placeholder="Password"
          />
        </FormItem>

        {/* 登录按钮 */}
        <FormItem style={formItemStyle}>
          <Button
            style={changeHeight}
            type="primary"
            htmlType="submit"
            className="login-form-button"
          >
            登录
          </Button>
        </FormItem>

        {/* <div className="qsso-breakline">
          <span className="qsso-breakword">或</span>
        </div>
        <Button style={changeHeight} id="qsso-login" type="primary" className="login-form-button" size="large" ghost>QSSO登录</Button> */}
      </Form>
    );
  }
}

type LoginFormProps = Omit<Partial<LoginProps>, 'form'>;

function LoginForm(props: LoginFormProps) {
  const [form] = Form.useForm<LoginCredentials>();
  return <Login {...props} form={form} />;
}

export default LoginForm;
