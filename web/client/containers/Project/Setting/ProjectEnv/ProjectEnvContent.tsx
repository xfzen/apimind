import React, { Component } from 'react';
import type { ComponentType, SyntheticEvent } from 'react';
import PropTypes from 'prop-types';
import './index.scss';
import { Row, Col, Form, Input, Select, Button, AutoComplete, Tooltip } from 'antd';
import type { FormInstance } from 'antd';
import Icon from 'client/shims/antdIcon';
const FormItem = Form.Item;
const Option = Select.Option;
import constants from 'client/constants/variable.js';

const initMap = {
  header: [
    {
      name: '',
      value: ''
    }
  ],
  cookie: [
    {
      name: '',
      value: ''
    }
  ],
  global: [
    {
      name: '',
      value: ''
    }
  ]
};

export interface EnvironmentEntry { name: string; value: string }
export interface ProjectEnvironment {
  _id?: string | number;
  name: string;
  domain: string;
  header: EnvironmentEntry[];
  global?: EnvironmentEntry[];
}
type EnvironmentListName = 'header' | 'cookie' | 'global';
interface ProjectEnvFormValues {
  header: EnvironmentEntry[];
  cookie: EnvironmentEntry[];
  global: EnvironmentEntry[];
  env: { name: string; domain: string; protocol: string };
}
interface ProjectEnvContentProps {
  projectMsg: ProjectEnvironment;
  form: FormInstance<ProjectEnvFormValues>;
  onSubmit: (value: { env: ProjectEnvironment }) => void;
  handleEnvInput: (value: string) => void;
}
interface ProjectEnvContentState {
  header: EnvironmentEntry[];
  cookie: EnvironmentEntry[];
  global: EnvironmentEntry[];
}

class ProjectEnvContent extends Component<ProjectEnvContentProps, ProjectEnvContentState> {
  static propTypes = {
    projectMsg: PropTypes.object,
    form: PropTypes.object,
    onSubmit: PropTypes.func,
    handleEnvInput: PropTypes.func
  };

  initState(curdata: ProjectEnvironment): ProjectEnvContentState {
    let header = [
      {
        name: '',
        value: ''
      }
    ];
    let cookie = [
      {
        name: '',
        value: ''
      }
    ];

    let global = [
      {
        name: '',
        value: ''
      }
    ];

    const curheader = curdata.header;
    const curGlobal = curdata.global;

    if (curheader && curheader.length !== 0) {
      curheader.forEach(item => {
        if (item.name === 'Cookie') {
          const cookieStr = item.value;
          if (cookieStr) {
            cookieStr.split(';').forEach(cookiePart => {
              if (cookiePart) {
                const parts = cookiePart.split('=');
                cookie.unshift({
                  name: parts[0] ? parts[0].trim() : '',
                  value: parts[1] ? parts[1].trim() : ''
                });
              }
            });
          }
        } else {
          header.unshift(item);
        }
      });
    }

    if (curGlobal && curGlobal.length !== 0) {
      curGlobal.forEach(item => {
        global.unshift(item);
      });
    }
    return { header, cookie, global };
  }

  constructor(props: ProjectEnvContentProps) {
    super(props);
    this.state = Object.assign({}, initMap);
  }
  addHeader = (_value: EnvironmentEntry, index: number, name: EnvironmentListName) => {
    let nextHeader = this.state[name][index + 1];
    if (nextHeader && typeof nextHeader === 'object') {
      return;
    }
    const newValue: Pick<ProjectEnvContentState, EnvironmentListName> = {
      [name]: this.state[name].concat({ name: '', value: '' })
    } as Pick<ProjectEnvContentState, EnvironmentListName>;
    this.setState(newValue);
  };

  delHeader = (key: number, name: EnvironmentListName) => {
    const curValue = this.props.form.getFieldValue(name) || [];
    const newValue = {
      [name]: curValue.filter((_val: EnvironmentEntry, index: number) => {
      return index !== key;
      })
    } as Pick<ProjectEnvContentState, EnvironmentListName>;
    this.props.form.setFieldsValue(newValue);
    this.setState(newValue);
  };

  handleInit(data: ProjectEnvironment) {
    this.props.form.resetFields();
    let newValue = this.initState(data);
    this.setState({ ...newValue }, () => {
      this.props.form.setFieldsValue({
        ...newValue,
        env: {
          name: data.name === '新环境' ? '' : data.name || '',
          domain: data.domain ? data.domain.split('//')[1] : '',
          protocol: data.domain ? data.domain.split('//')[0] + '//' : 'http://'
        }
      });
    });
  }

  componentWillReceiveProps(nextProps: ProjectEnvContentProps) {
    let curEnvName = this.props.projectMsg.name;
    let nextEnvName = nextProps.projectMsg.name;
    if (curEnvName !== nextEnvName) {
      this.handleInit(nextProps.projectMsg);
    }
  }

  handleOk = (e?: SyntheticEvent) => {
    if (e && e.preventDefault) {
      e.preventDefault();
    }
    const { form, onSubmit, projectMsg } = this.props;
    form
      .validateFields()
      .then((values: ProjectEnvFormValues) => {
        let header = values.header.filter(val => {
          return val.name !== '';
        });
        let cookie = values.cookie.filter(val => {
          return val.name !== '';
        });
        let global = values.global.filter(val => {
          return val.name !== '';
        });
        if (cookie.length > 0) {
          header.push({
            name: 'Cookie',
            value: cookie.map(item => item.name + '=' + item.value).join(';')
          });
        }
        const assignValue = { env: Object.assign(
          { _id: projectMsg._id },
          {
            name: values.env.name,
            domain: values.env.protocol + values.env.domain,
            header: header,
            global
          }
        ) };
        onSubmit(assignValue);
      })
      .catch(() => {});
  };

  render() {
    const { projectMsg } = this.props;
    const headerTpl = (item: EnvironmentEntry, index: number) => {
      const headerLength = this.state.header.length - 1;
      return (
        <Row gutter={2} key={index}>
          <Col span={10}>
            <FormItem
              name={['header', index, 'name']}
              validateTrigger={['onChange', 'onBlur']}
              initialValue={item.name || ''}
            >
                <AutoComplete
                  style={{ width: '200px' }}
                  allowClear={true}
                  options={constants.HTTP_REQUEST_HEADER.map(value => ({ value }))}
                  placeholder="请输入header名称"
                  onChange={() => this.addHeader(item, index, 'header')}
                  filterOption={(inputValue, option) =>
                    String(option?.value || '').toUpperCase().indexOf(inputValue.toUpperCase()) !== -1
                  }
                />
            </FormItem>
          </Col>
          <Col span={12}>
            <FormItem
              name={['header', index, 'value']}
              validateTrigger={['onChange', 'onBlur']}
              initialValue={item.value || ''}
            >
              <Input placeholder="请输入参数内容" style={{ width: '90%', marginRight: 8 }} />
            </FormItem>
          </Col>
          <Col span={2} className={index === headerLength ? ' env-last-row' : undefined}>
            {/* 新增的项中，只有最后一项没有有删除按钮 */}
            <Icon
              className="dynamic-delete-button delete"
              type="delete"
              onClick={e => {
                e.stopPropagation();
                this.delHeader(index, 'header');
              }}
            />
          </Col>
        </Row>
      );
    };

    const commonTpl = (item: EnvironmentEntry, index: number, name: EnvironmentListName) => {
      const length = this.state[name].length - 1;
      return (
        <Row gutter={2} key={index}>
          <Col span={10}>
            <FormItem
              name={[name, index, 'name']}
              validateTrigger={['onChange', 'onBlur']}
              initialValue={item.name || ''}
            >
                <Input
                  placeholder={`请输入 ${name} Name`}
                  style={{ width: '200px' }}
                  onChange={() => this.addHeader(item, index, name)}
                />
            </FormItem>
          </Col>
          <Col span={12}>
            <FormItem
              name={[name, index, 'value']}
              validateTrigger={['onChange', 'onBlur']}
              initialValue={item.value || ''}
            >
              <Input placeholder="请输入参数内容" style={{ width: '90%', marginRight: 8 }} />
            </FormItem>
          </Col>
          <Col span={2} className={index === length ? ' env-last-row' : undefined}>
            {/* 新增的项中，只有最后一项没有有删除按钮 */}
            <Icon
              className="dynamic-delete-button delete"
              type="delete"
              onClick={e => {
                e.stopPropagation();
                this.delHeader(index, name);
              }}
            />
          </Col>
        </Row>
      );
    };

    const envTpl = (data: ProjectEnvironment) => {
      return (
        <div>
          <h3 className="env-label">环境名称</h3>
          <FormItem
            required={false}
            name={['env', 'name']}
            validateTrigger={['onChange', 'onBlur']}
            initialValue={data.name === '新环境' ? '' : data.name || ''}
            rules={[
              {
                required: false,
                whitespace: true,
                validator(_rule: unknown, value: string) {
                  if (value && value.length > 0 && /\S/.test(value)) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('请输入环境名称'));
                }
              }
            ]}
          >
              <Input
                onChange={e => this.props.handleEnvInput(e.target.value)}
                placeholder="请输入环境名称"
                style={{ width: '90%', marginRight: 8 }}
              />
          </FormItem>
          <h3 className="env-label">环境域名</h3>
          <FormItem
            required={false}
            name={['env', 'domain']}
            validateTrigger={['onChange', 'onBlur']}
            initialValue={data.domain ? data.domain.split('//')[1] : ''}
            rules={[
              {
                required: false,
                whitespace: true,
                validator(_rule: unknown, value: string) {
                  if (!value || value.length === 0) {
                    return Promise.reject(new Error('请输入环境域名!'));
                  }
                  if (/\s/.test(value)) {
                    return Promise.reject(new Error('环境域名不允许出现空格!'));
                  }
                  return Promise.resolve();
                }
              }
            ]}
          >
              <Input
                placeholder="请输入环境域名"
                style={{ width: '90%', marginRight: 8 }}
                addonBefore={
                  <FormItem
                    name={['env', 'protocol']}
                    initialValue={data.domain ? data.domain.split('//')[0] + '//' : 'http://'}
                    rules={[
                      {
                        required: true
                      }
                    ]}
                    noStyle
                  >
                  <Select>
                    <Option value="http://">{'http://'}</Option>
                    <Option value="https://">{'https://'}</Option>
                  </Select>
                  </FormItem>
                }
              />
          </FormItem>
          <h3 className="env-label">Header</h3>
          {this.state.header.map((item, index) => {
            return headerTpl(item, index);
          })}

          <h3 className="env-label">Cookie</h3>
          {this.state.cookie.map((item, index) => {
            return commonTpl(item, index, 'cookie');
          })}

          <h3 className="env-label">
            global
            <a
              target="_blank"
              rel="noopener noreferrer"
              href="https://hellosean1025.github.io/yapi/documents/project.html#%E9%85%8D%E7%BD%AE%E7%8E%AF%E5%A2%83"
              style={{ marginLeft: 8 }}
            >
              <Tooltip title="点击查看文档">
                <Icon type="question-circle-o" style={{fontSize: '13px'}}/>
              </Tooltip>
            </a>
          </h3>
          {this.state.global.map((item, index) => {
            return commonTpl(item, index, 'global');
          })}
        </div>
      );
    };

    return (
      <div>
        <Form form={this.props.form}>
          {envTpl(projectMsg)}
          <div className="btnwrap-changeproject">
            <Button
              className="m-btn btn-save"
              icon={<Icon type="save" />}
              type="primary"
              size="large"
              onClick={this.handleOk}
            >
              保 存
            </Button>
          </div>
        </Form>
      </div>
    );
  }
}
type ProjectEnvContentOwnProps = Omit<ProjectEnvContentProps, 'form'>;
const ConnectedProjectEnvContent = ProjectEnvContent as unknown as ComponentType<ProjectEnvContentProps>;
function ProjectEnvContentForm(props: ProjectEnvContentOwnProps) {
  const [form] = Form.useForm();
  return <ConnectedProjectEnvContent {...props} form={form} />;
}

export default ProjectEnvContentForm;
