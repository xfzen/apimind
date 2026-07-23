import React, { PureComponent as Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { Form, Button, Input, message } from 'antd';
import Icon from 'client/shims/antdIcon';
import { regActions } from '../../reducer/modules/user';
import { withRouter } from 'react-router';
import { emailRule } from 'common/validators.js';
const FormItem = Form.Item;
const formItemStyle = {
  marginBottom: '.16rem'
};

const changeHeight = {
  height: '.42rem'
};

@connect(
  state => {
    return {
      loginData: state.user
    };
  },
  {
    regActions
  }
)
@withRouter
class Reg extends Component {
  constructor(props) {
    super(props);
    this.state = {
      confirmDirty: false
    };
  }

  static propTypes = {
    form: PropTypes.object,
    history: PropTypes.object,
    regActions: PropTypes.func
  };

  handleSubmit = e => {
    if (e && e.preventDefault) {
      e.preventDefault();
    }
    this.props.form
      .validateFields()
      .then(values => {
        this.props.regActions(values).then(res => {
          if (res.payload.data.errcode == 0) {
            this.props.history.replace('/group');
            message.success('注册成功! ');
          }
        });
      })
      .catch(() => {});
  };

  checkPassword = (rule, value) => {
    const form = this.props.form;
    if (value && value !== form.getFieldValue('password')) {
      return Promise.reject(new Error('两次输入的密码不一致啊!'));
    }
    return Promise.resolve();
  };

  checkConfirm = (rule, value) => {
    const form = this.props.form;
    if (value && this.state.confirmDirty) {
      form.validateFields(['confirm']);
    }
    return Promise.resolve();
  };

  render() {
    return (
      <Form form={this.props.form} onFinish={this.handleSubmit}>
        {/* 用户名 */}
        <FormItem
          style={formItemStyle}
          name="userName"
          rules={[{ required: true, message: '请输入用户名!' }]}
        >
          <Input
            style={changeHeight}
            prefix={<Icon type="user" style={{ fontSize: 13 }} />}
            placeholder="Username"
          />
        </FormItem>

        {/* Emaiil */}
        <FormItem
          style={formItemStyle}
          name="email"
          rules={[
            {
              required: true,
              message: '请输入email!'
            },
            emailRule('请输入email!')
          ]}
        >
          <Input
            style={changeHeight}
            prefix={<Icon type="mail" style={{ fontSize: 13 }} />}
            placeholder="Email"
          />
        </FormItem>

        {/* 密码 */}
        <FormItem
          style={formItemStyle}
          name="password"
          rules={[
            {
              required: true,
              message: '请输入密码!'
            },
            {
              validator: this.checkConfirm
            }
          ]}
        >
          <Input
            style={changeHeight}
            prefix={<Icon type="lock" style={{ fontSize: 13 }} />}
            type="password"
            placeholder="Password"
          />
        </FormItem>

        {/* 密码二次确认 */}
        <FormItem
          style={formItemStyle}
          name="confirm"
          rules={[
            {
              required: true,
              message: '请再次输入密码密码!'
            },
            {
              validator: this.checkPassword
            }
          ]}
        >
          <Input
            style={changeHeight}
            prefix={<Icon type="lock" style={{ fontSize: 13 }} />}
            type="password"
            placeholder="Confirm Password"
          />
        </FormItem>

        {/* 注册按钮 */}
        <FormItem style={formItemStyle}>
          <Button
            style={changeHeight}
            type="primary"
            htmlType="submit"
            className="login-form-button"
          >
            注册
          </Button>
        </FormItem>
      </Form>
    );
  }
}
function RegForm(props) {
  const [form] = Form.useForm();
  return <Reg {...props} form={form} />;
}

export default RegForm;
