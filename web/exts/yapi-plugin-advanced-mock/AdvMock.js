import React, { Component } from 'react';
// import { connect } from 'react-redux'
import axios from 'axios';
import PropTypes from 'prop-types';
import { withRouter } from 'react-router-dom';
import { Form, Switch, Button, message, Tooltip, Radio } from 'antd';
import Icon from 'client/shims/antdIcon';
import MockCol from './MockCol/MockCol.js';
import mockEditor from 'client/components/AceEditor/mockEditor';
import constants from '../../client/constants/variable.js';
const FormItem = Form.Item;

class AdvMock extends Component {
  static propTypes = {
    form: PropTypes.object,
    match: PropTypes.object
  };

  constructor(props) {
    super(props);
    this.state = {
      enable: false,
      mock_script: '',
      tab: 'case'
    };
  }

  handleSubmit = e => {
    e.preventDefault();
    let projectId = this.props.match.params.id;
    let interfaceId = this.props.match.params.actionId;
    let params = {
      project_id: projectId,
      interface_id: interfaceId,
      mock_script: this.state.mock_script,
      enable: this.state.enable
    };
    axios.post('/api/plugin/advmock/save', params).then(res => {
      if (res.data.errcode === 0) {
        message.success('保存成功');
      } else {
        message.error(res.data.errmsg);
      }
    });
  };

  componentDidMount() {
    this.getAdvMockData();
  }

  componentWillUnmount() {
    if (this.mockScriptEditor && this.mockScriptEditor.editor) {
      this.mockScriptEditor.editor.destroy();
    }
    this.mockScriptEditor = null;
  }

  componentDidUpdate(prevProps, prevState) {
    const prevInterfaceId = prevProps.match.params.actionId;
    const interfaceId = this.props.match.params.actionId;
    if (prevInterfaceId !== interfaceId) {
      if (this.mockScriptEditor && this.mockScriptEditor.editor) {
        this.mockScriptEditor.editor.destroy();
      }
      this.mockScriptEditor = null;
      this.getAdvMockData();
      return;
    }

    if (prevState.tab !== this.state.tab && this.state.tab === 'script') {
      this.resizeMockScriptEditor();
    }
  }

  async getAdvMockData() {
    let interfaceId = this.props.match.params.actionId;
    let result = await axios.get('/api/plugin/advmock/get?interface_id=' + interfaceId);
    let nextState = {};
    if (result.data.errcode === 0) {
      let mockData = result.data.data;
      nextState = {
        enable: mockData.enable,
        mock_script: mockData.mock_script
      };
    }

    this.setState(nextState, () => this.initMockScriptEditor());
  }

  initMockScriptEditor = () => {
    if (!document.getElementById('mock-script')) {
      return;
    }
    if (this.mockScriptEditor) {
      this.mockScriptEditor.setValue(this.state.mock_script);
      this.resizeMockScriptEditor();
      return;
    }

    this.mockScriptEditor = mockEditor({
      container: 'mock-script',
      data: this.state.mock_script,
      onChange: d => {
        this.setState({
          mock_script: d.text
        });
      }
    });
    this.resizeMockScriptEditor();
  };

  resizeMockScriptEditor = () => {
    if (this.mockScriptEditor && this.mockScriptEditor.editor) {
      this.mockScriptEditor.editor.resize();
    }
  };

  onChange = v => {
    this.setState({
      enable: v
    });
  };

  handleTapChange = e => {
    this.setState({
      tab: e.target.value
    });
  };

  render() {
    const formItemLayout = {
      labelCol: {
        sm: { span: 4 }
      },
      wrapperCol: {
        sm: { span: 16 }
      }
    };
    const tailFormItemLayout = {
      wrapperCol: {
        sm: {
          span: 16,
          offset: 11
        }
      }
    };
    const { tab } = this.state;
    const isShowCase = tab === 'case';
    return (
      <div style={{ padding: '20px 10px' }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <Radio.Group value={tab} size="large" onChange={this.handleTapChange}>
            <Radio.Button value="case">期望</Radio.Button>
            <Radio.Button value="script">脚本</Radio.Button>
          </Radio.Group>
        </div>
        <div style={{ display: isShowCase ? 'none' : '' }}>
          <Form onSubmit={this.handleSubmit}>
            <FormItem
              label={
                <span>
                  是否开启&nbsp;<a
                    target="_blank"
                    rel="noopener noreferrer"
                    href={constants.docHref.adv_mock_script}
                  >
                    <Tooltip title="点击查看文档">
                      <Icon type="question-circle-o" />
                    </Tooltip>
                  </a>
                </span>
              }
              {...formItemLayout}
            >
              <Switch
                checked={this.state.enable}
                onChange={this.onChange}
                checkedChildren="开"
                unCheckedChildren="关"
              />
            </FormItem>

            <FormItem label="Mock脚本" {...formItemLayout}>
              <div id="mock-script" style={{ minHeight: '500px' }} />
            </FormItem>
            <FormItem {...tailFormItemLayout}>
              <Button type="primary" htmlType="submit">
                保存
              </Button>
            </FormItem>
          </Form>
        </div>
        <div style={{ display: isShowCase ? '' : 'none' }}>
          <MockCol />
        </div>
      </div>
    );
  }
}

module.exports = withRouter(AdvMock);
