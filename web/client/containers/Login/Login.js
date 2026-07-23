import React, { PureComponent as Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { Form, Button, Input, message, Radio } from 'antd';
import Icon from 'client/shims/antdIcon';
import { loginActions, loginLdapActions } from '../../reducer/modules/user';
import { withRouter } from 'react-router';
import { emailRule as safeEmailRule } from 'common/validators.js';
const FormItem = Form.Item;
const RadioGroup = Radio.Group;

import './Login.scss';

const formItemStyle = {
  marginBottom: '.16rem'
};

const changeHeight = {
  height: '.42rem'
};

@connect(
  state => {
    return {
      loginData: state.user,
      isLDAP: state.user.isLDAP
    };
  },
  {
    loginActions,
    loginLdapActions
  }
)
@withRouter
class Login extends Component {
  constructor(props) {
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

  handleSubmit = e => {
    if (e && e.preventDefault) {
      e.preventDefault();
    }
    this.props.form
      .validateFields()
      .then(values => {
        if (this.props.isLDAP && this.state.loginType === 'ldap') {
          this.props.loginLdapActions(values).then(res => {
            if (res.payload.data.errcode == 0) {
              this.props.history.replace('/group');
              message.success('登录成功! ');
            }
          });
        } else {
          this.props.loginActions(values).then(res => {
            if (res.payload.data.errcode == 0) {
              this.props.history.replace('/group');
              message.success('登录成功! ');
            }
          });
        }
      })
      .catch(() => {});
  };

  componentDidMount() {
    //Qsso.attach('qsso-login','/api/user/login_by_token')
    console.log('isLDAP', this.props.isLDAP);
  }
  handleFormLayoutChange = e => {
    this.setState({ loginType: e.target.value });
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
function LoginForm(props) {
  const [form] = Form.useForm();
  return <Login {...props} form={form} />;
}

export default LoginForm;
