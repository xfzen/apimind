import React, { PureComponent as Component } from 'react';
import type { ComponentType } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { Form, Button, message } from 'antd';
const FormItem = Form.Item;
import './project-request.scss';
import AceEditor from 'client/components/AceEditor/AceEditor';
import { updateProjectScript, getProject } from '../../../../reducer/modules/project';
import type { MockEditorData } from '../../../../components/AceEditor/mockEditor';
import type { ApiResponse } from '../../../../types/api';
import type { RootState } from '../../../../reducer/modules/reducer';
import type { UnknownRecord } from '../../../../reducer/types/runtime';
import { asLegacyClassDecorator } from '../../../../types/legacyDecorators';

type ProjectRequestResponse = { payload: { data: ApiResponse<unknown> } };
interface ProjectRequestProps {
  projectId: number;
  projectMsg: UnknownRecord & { pre_script?: string; after_script?: string };
  updateProjectScript: (data: UnknownRecord) => Promise<ProjectRequestResponse>;
  getProject: (id: number) => Promise<unknown>;
}
interface ProjectRequestState { pre_script: string; after_script: string }
const connectProjectRequest = asLegacyClassDecorator(connect(
  (state: RootState) => {
    return {
      projectMsg: state.project.currProject
    };
  },
  {
    updateProjectScript,
    getProject
  }
));
@connectProjectRequest
class ProjectRequest extends Component<ProjectRequestProps, ProjectRequestState> {
  state: ProjectRequestState = { pre_script: '', after_script: '' };
  static propTypes = {
    projectMsg: PropTypes.object,
    updateProjectScript: PropTypes.func,
    getProject: PropTypes.func,
    projectId: PropTypes.number
  };

  componentWillMount() {
    this.setState({
      pre_script: this.props.projectMsg.pre_script ?? '',
      after_script: this.props.projectMsg.after_script ?? ''
    });
  }

  handleSubmit = async () => {
    let result = await this.props.updateProjectScript({
      id: this.props.projectId,
      pre_script: this.state.pre_script,
      after_script: this.state.after_script
    });
    if (result.payload.data.errcode === 0) {
      message.success('保存成功');
      await this.props.getProject(this.props.projectId);
    } else {
      message.success('保存失败, ' + result.payload.data.errmsg);
    }
  };

  render() {
    const formItemLayout = {
      labelCol: {
        xs: { span: 24 },
        sm: { span: 6 }
      },
      wrapperCol: {
        xs: { span: 24 },
        sm: { span: 16 }
      }
    };

    const tailFormItemLayout = {
      wrapperCol: {
        xs: {
          span: 24,
          offset: 0
        },
        sm: {
          span: 16,
          offset: 8
        }
      }
    };

    const { pre_script, after_script } = this.state;

    return (
      <div className="project-request">
        <Form>
          <FormItem {...formItemLayout} label="Pre-request Script(请求参数处理脚本)">
            <AceEditor
              data={pre_script}
              onChange={(editor: MockEditorData) => this.setState({ pre_script: editor.text })}
              fullScreen={true}
              className="request-editor"
            />
          </FormItem>
          <FormItem {...formItemLayout} label="Pre-response Script(响应数据处理脚本)">
            <AceEditor
              data={after_script}
              onChange={(editor: MockEditorData) => this.setState({ after_script: editor.text })}
              fullScreen={true}
              className="request-editor"
            />
          </FormItem>
          <FormItem {...tailFormItemLayout}>
            <Button onClick={this.handleSubmit} type="primary">
              保存
            </Button>
          </FormItem>
        </Form>
      </div>
    );
  }
}

export default ProjectRequest as unknown as ComponentType<Pick<ProjectRequestProps, 'projectId'>>;
