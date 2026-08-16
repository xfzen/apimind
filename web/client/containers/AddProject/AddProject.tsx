import React, { PureComponent as Component } from 'react';
import type { ComponentType, FocusEvent, SyntheticEvent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { Button, Form, Input, Tooltip, Select, message, Row, Col, Radio } from 'antd';
import type { FormInstance } from 'antd';
import Icon from 'client/shims/antdIcon';
import { addProject } from '../../reducer/modules/project';
import { fetchGroupList } from '../../reducer/modules/group';
import { autobind } from 'core-decorators';
import { setBreadcrumb } from '../../reducer/modules/user';
const { TextArea } = Input;
const FormItem = Form.Item;
const Option = Select.Option;
const RadioGroup = Radio.Group;
import { pickRandomProperty, handlePath, nameLengthLimit } from '../../common';
import constants from '../../constants/variable.js';
import { withRouter } from 'react-router';
import type { RouteComponentProps } from 'react-router';
import type { ApiResponse } from '../../types/api';
import type { BreadcrumbItem } from '../../types/user';
import type { RootState } from '../../reducer/modules/reducer';
import type { GroupRecord } from '../../reducer/modules/group';
import type { UnknownRecord } from '../../reducer/types/runtime';
import { asLegacyClassDecorator } from '../../types/legacyDecorators';
import './Addproject.scss';

interface AddProjectGroup extends GroupRecord { role?: string }
interface ProjectFormValues extends UnknownRecord {
  group: string;
  group_id?: string;
  name: string;
  basepath?: string | null;
  desc?: string;
  project_type: string;
  icon?: string;
  color?: string;
}
interface ProjectListProps extends RouteComponentProps {
  groupList: AddProjectGroup[];
  currGroup: AddProjectGroup;
  form: FormInstance<ProjectFormValues>;
  addProject: (values: ProjectFormValues) => Promise<{
    payload: { data: ApiResponse<{ _id: string | number }> };
  }>;
  setBreadcrumb: (data: BreadcrumbItem[]) => unknown;
  fetchGroupList: () => Promise<unknown>;
}
interface ProjectListState {
  groupList: AddProjectGroup[];
  currGroupId: string | number | null;
}

const formItemLayout = {
  labelCol: {
    lg: { span: 3 },
    xs: { span: 24 },
    sm: { span: 6 }
  },
  wrapperCol: {
    lg: { span: 21 },
    xs: { span: 24 },
    sm: { span: 14 }
  },
  className: 'form-item'
};

const connectProjectList = asLegacyClassDecorator(connect(
  (state: RootState) => {
    return {
      groupList: state.group.groupList,
      currGroup: state.group.currGroup
    };
  },
  {
    fetchGroupList,
    addProject,
    setBreadcrumb
  }
));
const routeProjectList = asLegacyClassDecorator(withRouter);
@connectProjectList
@routeProjectList
class ProjectList extends Component<ProjectListProps, ProjectListState> {
  constructor(props: ProjectListProps) {
    super(props);
    this.state = {
      groupList: [],
      currGroupId: null
    };
  }
  static propTypes = {
    groupList: PropTypes.array,
    form: PropTypes.object,
    currGroup: PropTypes.object,
    addProject: PropTypes.func,
    history: PropTypes.object,
    setBreadcrumb: PropTypes.func,
    fetchGroupList: PropTypes.func
  };

  handlePath = (e: FocusEvent<HTMLInputElement>) => {
    let val = e.target.value;
    this.props.form.setFieldsValue({
      basepath: handlePath(val)
    });
  };

  // 确认添加项目
  @autobind
  handleOk(e?: SyntheticEvent) {
    const { form, addProject } = this.props;
    if (e && e.preventDefault) {
      e.preventDefault();
    }
    form
      .validateFields()
      .then((values: ProjectFormValues) => {
        values.group_id = values.group;
        values.icon = constants.PROJECT_ICON[0];
        values.color = pickRandomProperty(constants.PROJECT_COLOR);
        addProject(values).then(res => {
          if (res.payload.data.errcode == 0) {
            form.resetFields();
            message.success('创建成功! ');
            const project = res.payload.data.data;
            if (project) this.props.history.push('/project/' + project._id + '/interface/api');
          }
        });
      })
      .catch(() => {});
  }

  async componentWillMount() {
    this.props.setBreadcrumb([{ name: '新建项目' }]);
    if (!this.props.currGroup._id) {
      await this.props.fetchGroupList();
    }
    if (this.props.groupList.length === 0) {
      return null;
    }
    this.setState({
      currGroupId: this.props.currGroup._id ? this.props.currGroup._id : this.props.groupList[0]._id ?? null
    });
    this.setState({ groupList: this.props.groupList });
  }

  render() {
    return (
      <div className="g-row">
        <div className="g-row m-container">
          <Form form={this.props.form}>
            <FormItem {...formItemLayout} label="项目名称" name="name" rules={nameLengthLimit('项目')}>
              <Input />
            </FormItem>

            <FormItem
              {...formItemLayout}
              label="所属分组"
              name="group"
              initialValue={this.state.currGroupId + ''}
              rules={[
                {
                  required: true,
                  message: '请选择项目所属的分组!'
                }
              ]}
            >
              <Select>
                {this.state.groupList.map((item, index) => (
                  <Option
                    disabled={
                      !(item.role === 'dev' || item.role === 'owner' || item.role === 'admin')
                    }
                    value={String(item._id)}
                    key={index}
                  >
                    {item.group_name}
                  </Option>
                ))}
              </Select>
            </FormItem>

            <hr className="breakline" />

            <FormItem
              {...formItemLayout}
              label={
                <span>
                  基本路径&nbsp;
                  <Tooltip title="接口基本路径，为空是根路径">
                    <Icon type="question-circle-o" />
                  </Tooltip>
                </span>
              }
              name="basepath"
              rules={[
                {
                  required: false,
                  message: '请输入项目基本路径'
                }
              ]}
            >
              <Input onBlur={this.handlePath} />
            </FormItem>

            <FormItem
              {...formItemLayout}
              label="描述"
              name="desc"
              rules={[
                {
                  required: false,
                  message: '描述不超过144字!',
                  max: 144
                }
              ]}
            >
              <TextArea rows={4} />
            </FormItem>

            <FormItem
              {...formItemLayout}
              label="权限"
              name="project_type"
              rules={[
                {
                  required: true
                }
              ]}
              initialValue="private"
            >
              <RadioGroup>
                <Radio value="private" className="radio">
                  <Icon type="lock" />私有<br />
                  <span className="radio-desc">只有组长和项目开发者可以索引并查看项目信息</span>
                </Radio>
                <br />
                {/* <Radio value="public" className="radio">
                    <Icon type="unlock" />公开<br />
                    <span className="radio-desc">任何人都可以索引并查看项目信息</span>
                  </Radio> */}
              </RadioGroup>
            </FormItem>
          </Form>
          <Row>
            <Col sm={{ offset: 6 }} lg={{ offset: 3 }}>
              <Button className="m-btn" icon={<Icon type="plus" />} type="primary" onClick={this.handleOk}>
                创建项目
              </Button>
            </Col>
          </Row>
        </div>
      </div>
    );
  }
}

const ConnectedProjectList = ProjectList as unknown as ComponentType<{ form: FormInstance<ProjectFormValues> }>;

function ProjectListForm() {
  const [form] = Form.useForm();
  return <ConnectedProjectList form={form} />;
}

export default ProjectListForm;
