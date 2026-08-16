import React, { PureComponent as Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { Form, Button, Input, message } from 'antd';
import type { FormInstance } from 'antd';
import type { RouteComponentProps } from 'react-router';
import { withRouter } from 'react-router';
import Icon from 'client/shims/antdIcon';
import { emailRule } from 'common/validators.js';

import type { AppDispatch, ResolvedPromiseAction } from '../../reducer/promiseTypes';
import { regActions } from '../../reducer/modules/user';
import { selectUser, type UserRootState } from '../../reducer/selectors/user';
import type {
  RegisterCredentials,
  RegisterResponse,
  UserState
} from '../../types/user';
import { asLegacyClassDecorator } from '../../types/legacyDecorators';

const FormItem = Form.Item;
const formItemStyle = {
  marginBottom: '.16rem'
};

const changeHeight = {
  height: '.42rem'
};

type RegisterDispatchResult = Promise<ResolvedPromiseAction<RegisterResponse>>;

interface RegProps {
  form: FormInstance<RegisterCredentials>;
  history?: RouteComponentProps['history'];
  regActions?: (values: RegisterCredentials) => RegisterDispatchResult;
  loginData?: UserState;
}

interface RegState {
  confirmDirty: boolean;
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
  loginData: selectUser(state)
});

const mapDispatch = (dispatch: AppDispatch) => ({
  regActions: (values: RegisterCredentials) => dispatch(regActions(values))
});

const connectReg = asLegacyClassDecorator(connect(mapState, mapDispatch));
const routeReg = asLegacyClassDecorator(withRouter);

@connectReg
@routeReg
class Reg extends Component<RegProps, RegState> {
  constructor(props: RegProps) {
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

  handleSubmit = (event: unknown) => {
    if (hasPreventDefault(event)) {
      event.preventDefault();
    }
    this.props.form
      .validateFields()
      .then(values => {
        this.props.regActions!(values).then(res => {
          if (res.payload.data.errcode === 0) {
            this.props.history!.replace('/group');
            message.success('注册成功! ');
          }
        });
      })
      .catch(() => {});
  };

  checkPassword = (_rule: unknown, value: unknown) => {
    const form = this.props.form;
    if (value && value !== form.getFieldValue('password')) {
      return Promise.reject(new Error('两次输入的密码不一致啊!'));
    }
    return Promise.resolve();
  };

  checkConfirm = (_rule: unknown, value: unknown) => {
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

type RegFormProps = Omit<Partial<RegProps>, 'form'>;

function RegForm(props: RegFormProps) {
  const [form] = Form.useForm<RegisterCredentials>();
  return <Reg {...props} form={form} />;
}

export default RegForm;
