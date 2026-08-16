import React, { PureComponent as Component } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import { withRouter } from 'react-router';
import { Link } from 'react-router-dom';
//import constants from '../../../../constants/variable.js'
import { Tooltip, Input, Button, Row, Col, Spin, Modal, message, Select, Switch, Table as AntTable } from 'antd';
import Icon from 'client/shims/antdIcon';
import {
  fetchInterfaceColList,
  fetchCaseList,
  setColData,
  fetchCaseEnvList
} from '../../../../reducer/modules/interfaceCol';
import { getToken, getEnv } from '../../../../reducer/modules/project';
import AceEditor from 'client/components/AceEditor/AceEditor';
import axios from 'axios';
import CaseReport from './CaseReport.js';
import _ from 'underscore';
import produce from 'immer';
import {InsertCodeMap} from 'client/components/Postman/Postman.js'

import { handleCurrDomain, checkNameIsExistInArray } from 'common/postmanLib.js';
import { getBackendOrigin } from '../../../../utils/backend';
import CaseEnv from 'client/components/CaseEnv';
import Label from '../../../../components/Label/Label';

const Option = Select.Option;

import copy from 'copy-to-clipboard';

const defaultModalStyle = {
  top: 10
}

function handleReport(json) {
  try {
    return JSON.parse(json);
  } catch (e) {
    return {};
  }
}

@connect(
  state => {
    return {
      interfaceColList: state.interfaceCol.interfaceColList,
      currColId: state.interfaceCol.currColId,
      currCaseId: state.interfaceCol.currCaseId,
      isShowCol: state.interfaceCol.isShowCol,
      isRander: state.interfaceCol.isRander,
      currCaseList: state.interfaceCol.currCaseList,
      currProject: state.project.currProject,
      token: state.project.token,
      envList: state.interfaceCol.envList,
      curProjectRole: state.project.currProject.role,
      projectEnv: state.project.projectEnv
    };
  },
  {
    fetchInterfaceColList,
    fetchCaseList,
    setColData,
    getToken,
    getEnv,
    fetchCaseEnvList
  }
)
@withRouter
class InterfaceColContent extends Component {
  static propTypes = {
    match: PropTypes.object,
    interfaceColList: PropTypes.array,
    fetchInterfaceColList: PropTypes.func,
    fetchCaseList: PropTypes.func,
    setColData: PropTypes.func,
    history: PropTypes.object,
    currCaseList: PropTypes.array,
    currColId: PropTypes.number,
    currCaseId: PropTypes.number,
    isShowCol: PropTypes.bool,
    isRander: PropTypes.bool,
    currProject: PropTypes.object,
    getToken: PropTypes.func,
    token: PropTypes.string,
    curProjectRole: PropTypes.string,
    getEnv: PropTypes.func,
    projectEnv: PropTypes.object,
    fetchCaseEnvList: PropTypes.func,
    envList: PropTypes.array
  };

  constructor(props) {
    super(props);
    this.reports = {};
    this.state = {
      rows: [],
      reports: {},
      visible: false,
      curCaseid: null,
      advVisible: false,
      curScript: '',
      enableScript: false,
      autoVisible: false,
      mode: 'html',
      email: false,
      download: false,
      currColEnvObj: {},
      collapseKey: '1',
      commonSettingModalVisible: false,
      commonSetting: {
        checkHttpCodeIs200: false,
        checkResponseField: {
          name: 'code',
          value: '0',
          enable: false
        },
        checkResponseSchema: false,
        checkScript:{
          enable: false,
          content: ''
        }
      }
    };
  }

  async handleColIdChange(newColId){
    this.props.setColData({
      currColId: +newColId,
      isShowCol: true,
      isRander: false
    });

    let result = await this.props.fetchCaseList(newColId);
    if (result.payload.data.errcode === 0) {
      this.reports = handleReport(result.payload.data.colData.test_report);
      this.setState({
        commonSetting:{
          ...this.state.commonSetting,
          ...result.payload.data.colData
        }
      })
    }

    await this.props.fetchCaseList(newColId);
    await this.props.fetchCaseEnvList(newColId);
    this.changeCollapseClose();
    this.handleColdata(this.props.currCaseList);
  }

  async componentWillMount() {
    const result = await this.props.fetchInterfaceColList(this.props.match.params.id);
    await this.props.getToken(this.props.match.params.id);
    let { currColId } = this.props;
    const params = this.props.match.params;
    const { actionId } = params;
    this.currColId = currColId = +actionId || result.payload.data.data[0]._id;
    // this.props.history.push('/project/' + params.id + '/interface/col/' + currColId);
    if (currColId && currColId != 0) {
      await this.handleColIdChange(currColId)
    }

  }

  // 更新分类简介
  handleChangeInterfaceCol = (desc, name) => {
    let params = {
      col_id: this.props.currColId,
      name: name,
      desc: desc
    };

    axios.post('/api/col/up_col', params).then(async res => {
      if (res.data.errcode) {
        return message.error(res.data.errmsg);
      }
      let project_id = this.props.match.params.id;
      await this.props.fetchInterfaceColList(project_id);
      message.success('接口集合简介更新成功');
    });
  };

  // 整合header信息
  handleReqHeader = (project_id, req_header, case_env) => {
    let envItem = _.find(this.props.envList, item => {
      return item._id === project_id;
    });

    let currDomain = handleCurrDomain(envItem && envItem.env, case_env);
    let header = currDomain.header;
    header.forEach(item => {
      if (!checkNameIsExistInArray(item.name, req_header)) {
        // item.abled = true;
        item = {
          ...item,
          abled: true
        };
        req_header.push(item);
      }
    });
    return req_header;
  };

  handleColdata = (rows, currColEnvObj = {}) => {
    let that = this;
    let newRows = produce(rows, draftRows => {
      draftRows.map(item => {
        item.id = item._id;
        item._test_status = item.test_status;
        if(currColEnvObj[item.project_id]){
          item.case_env =currColEnvObj[item.project_id];
        }
        item.req_headers = that.handleReqHeader(item.project_id, item.req_headers, item.case_env);
        return item;
      });
    });
    this.setState({ rows: newRows });
  };

  persistCaseOrder = rows => {
    let changes = [];
    rows.forEach((item, index) => {
      changes.push({ id: item._id, index: index });
    });
    axios.post('/api/col/up_case_index', changes).then(() => {
      this.props.fetchInterfaceColList(this.props.match.params.id);
    });
  };

  moveCaseRow = (index, direction) => {
    const rows = this.state.rows.slice();
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= rows.length) {
      return;
    }
    const current = rows.splice(index, 1)[0];
    rows.splice(targetIndex, 0, current);
    this.setState({ rows }, () => this.persistCaseOrder(rows));
  };

  onChangeTest = d => {
    
    this.setState({
      commonSetting: {
        ...this.state.commonSetting,
        checkScript: {
          ...this.state.commonSetting.checkScript,
          content: d.text
        }
      }
    });
  };

  handleInsertCode = code => {
    this.aceEditor.editor.insertCode(code);
  };

  async componentWillReceiveProps(nextProps) {
    let newColId = !isNaN(nextProps.match.params.actionId) ? +nextProps.match.params.actionId : 0;

    if (newColId && ((this.currColId && newColId !== this.currColId) || nextProps.isRander)) {
      this.currColId = newColId;
      this.handleColIdChange(newColId)
    }
  }

  // 测试用例环境面板折叠
  changeCollapseClose = key => {
    if (key) {
      this.setState({
        collapseKey: key
      });
    } else {
      this.setState({
        collapseKey: '1',
        currColEnvObj: {}
      });
    }
  };

  openReport = id => {
    if (!this.reports[id]) {
      return message.warn('还没有生成报告');
    }
    this.setState({ visible: true, curCaseid: id });
  };

  openAdv = id => {
    let findCase = _.find(this.props.currCaseList, item => item.id === id);

    this.setState({
      enableScript: findCase.enable_script,
      curScript: findCase.test_script,
      advVisible: true,
      curCaseid: id
    });
  };

  handleScriptChange = d => {
    this.setState({ curScript: d.text });
  };

  handleAdvCancel = () => {
    this.setState({ advVisible: false });
  };

  handleAdvOk = async () => {
    const { curCaseid, enableScript, curScript } = this.state;
    const res = await axios.post('/api/col/up_case', {
      id: curCaseid,
      test_script: curScript,
      enable_script: enableScript
    });
    if (res.data.errcode === 0) {
      message.success('更新成功');
    }
    this.setState({ advVisible: false });
    let currColId = this.currColId;
    this.props.setColData({
      currColId: +currColId,
      isShowCol: true,
      isRander: false
    });
    await this.props.fetchCaseList(currColId);

    this.handleColdata(this.props.currCaseList);
  };

  handleCancel = () => {
    this.setState({ visible: false });
  };

  currProjectEnvChange = (envName, project_id) => {
    let currColEnvObj = {
      ...this.state.currColEnvObj,
      [project_id]: envName
    };
    this.setState({ currColEnvObj });
   // this.handleColdata(this.props.currCaseList, envName, project_id);
   this.handleColdata(this.props.currCaseList,currColEnvObj);
  };

  autoTests = () => {
    this.setState({ autoVisible: true, currColEnvObj: {}, collapseKey: '' });
  };

  handleAuto = () => {
    this.setState({
      autoVisible: false,
      email: false,
      download: false,
      mode: 'html',
      currColEnvObj: {},
      collapseKey: ''
    });
  };

  copyUrl = url => {
    copy(url);
    message.success('已经成功复制到剪切板');
  };

  modeChange = mode => {
    this.setState({ mode });
  };

  emailChange = email => {
    this.setState({ email });
  };

  downloadChange = download => {
    this.setState({ download });
  };

  handleColEnvObj = envObj => {
    let str = '';
    for (let key in envObj) {
      str += envObj[key] ? `&env_${key}=${envObj[key]}` : '';
    }
    return str;
  };

  handleCommonSetting = ()=>{
    let setting = this.state.commonSetting;

    let params = {
      col_id: this.props.currColId,
      ...setting

    };
    console.log(params)

    axios.post('/api/col/up_col', params).then(async res => {
      if (res.data.errcode) {
        return message.error(res.data.errmsg);
      }
      message.success('配置测试集成功');
    });

    this.setState({
      commonSettingModalVisible: false
    })
  }

  cancelCommonSetting = ()=>{
    this.setState({
      commonSettingModalVisible: false
    })
  }

  openCommonSetting = ()=>{
    this.setState({
      commonSettingModalVisible: true
    })
  }

  changeCommonFieldSetting = (key)=>{
    return (e)=>{
      let value = e;
      if(typeof e === 'object' && e){
        value = e.target.value;
      }
      let {checkResponseField} = this.state.commonSetting;
      this.setState({
        commonSetting: {
          ...this.state.commonSetting,
          checkResponseField: {
            ...checkResponseField,
            [key]: value
          }
        }
      })
    }
  }
  
  render() {
    const currProjectId = this.props.currProject._id;
    const columns = [
      {
        title: '用例名称',
        dataIndex: 'casename',
        width: 250,
        render: (text, record) => (
          <Link to={'/project/' + currProjectId + '/interface/case/' + record._id}>
            {record.casename.length > 23
              ? record.casename.substr(0, 20) + '...'
              : record.casename}
          </Link>
        )
      },
      {
        title: (
          <Tooltip
            title={
              <span>
                {' '}
                每个用例都有唯一的key，用于获取所匹配接口的响应数据，例如使用{' '}
                <a
                  href="https://hellosean1025.github.io/yapi/documents/case.html#%E7%AC%AC%E4%BA%8C%E6%AD%A5%EF%BC%8C%E7%BC%96%E8%BE%91%E6%B5%8B%E8%AF%95%E7%94%A8%E4%BE%8B"
                  className="link-tooltip"
                  target="blank"
                >
                  {' '}
                  变量参数{' '}
                </a>{' '}
                功能{' '}
              </span>
            }
          >
            Key
          </Tooltip>
        ),
        dataIndex: '_id',
        width: 100
      },
      {
        title: '状态',
        dataIndex: 'test_status',
        width: 100,
        render: (value, record) => {
              let id = record._id;
              let code = this.reports[id] ? this.reports[id].code : 0;
              if (record.test_status === 'loading') {
                return (
                  <div>
                    <Spin />
                  </div>
                );
              }

              switch (code) {
                case 0:
                  return (
                    <div>
                      <Tooltip title="Pass">
                        <Icon
                          style={{
                            color: '#00a854'
                          }}
                          type="check-circle"
                        />
                      </Tooltip>
                    </div>
                  );
                case 400:
                  return (
                    <div>
                      <Tooltip title="请求异常">
                        <Icon
                          type="info-circle"
                          style={{
                            color: '#f04134'
                          }}
                        />
                      </Tooltip>
                    </div>
                  );
                case 1:
                  return (
                    <div>
                      <Tooltip title="验证失败">
                        <Icon
                          type="exclamation-circle"
                          style={{
                            color: '#ffbf00'
                          }}
                        />
                      </Tooltip>
                    </div>
                  );
                default:
                  return (
                    <div>
                      <Icon
                        style={{
                          color: '#00a854'
                        }}
                        type="check-circle"
                      />
                    </div>
                  );
              }
        }
      },
      {
        title: '接口路径',
        dataIndex: 'path',
        render: (text, record) => (
          <Tooltip title="跳转到对应接口">
            <Link to={`/project/${record.project_id}/interface/api/${record.interface_id}`}>
              {record.path.length > 23 ? record.path + '...' : record.path}
            </Link>
          </Tooltip>
        )
      },
      {
        title: '排序',
        width: 100,
        render: (text, record, index) => (
          <div className="interface-col-table-action">
            <Button
              size="small"
              icon={<Icon type="arrow-up" />}
              disabled={index === 0}
              onClick={() => this.moveCaseRow(index, -1)}
            />
            <Button
              size="small"
              icon={<Icon type="arrow-down" />}
              disabled={index === rows.length - 1}
              onClick={() => this.moveCaseRow(index, 1)}
            />
          </div>
        )
      },
      {
        title: '测试报告',
        width: 200,
        render: (text, rowData) => {
              let reportFun = () => {
                if (!this.reports[rowData.id]) {
                  return null;
                }
                return <Button onClick={() => this.openReport(rowData.id)}>测试报告</Button>;
              };
              return <div className="interface-col-table-action">{reportFun()}</div>;
        }
      }
    ];
    const { rows } = this.state;

    const localUrl = getBackendOrigin();
    let currColEnvObj = this.handleColEnvObj(this.state.currColEnvObj);
    const autoTestsUrl = `/api/open/run_auto_test?id=${this.props.currColId}&token=${
      this.props.token
    }${currColEnvObj ? currColEnvObj : ''}&mode=${this.state.mode}&email=${
      this.state.email
    }&download=${this.state.download}`;

    let col_name = '';
    let col_desc = '';

    for (var i = 0; i < this.props.interfaceColList.length; i++) {
      if (this.props.interfaceColList[i]._id === this.props.currColId) {
        col_name = this.props.interfaceColList[i].name;
        col_desc = this.props.interfaceColList[i].desc;
        break;
      }
    }

    return (
      <div className="interface-col">
        <Modal
            title="通用规则配置"
            open={this.state.commonSettingModalVisible}
            onOk={this.handleCommonSetting}
            onCancel={this.cancelCommonSetting}
            width={'1000px'}
            style={defaultModalStyle}
          >
          <div className="common-setting-modal">
            <Row className="setting-item">
              <Col className="col-item" span="4">
                <label>检查HttpCode:&nbsp;<Tooltip title={'检查 http code 是否为 200'}>
                  <Icon type="question-circle-o" style={{ width: '10px' }} />
                </Tooltip></label>
              </Col>
              <Col className="col-item"  span="18">
                <Switch onChange={e=>{
                  let {commonSetting} = this.state;
                  this.setState({
                    commonSetting :{
                      ...commonSetting,
                      checkHttpCodeIs200: e
                    }
                  })
                }} checked={this.state.commonSetting.checkHttpCodeIs200}  checkedChildren="开" unCheckedChildren="关" />
              </Col>
            </Row>

            <Row className="setting-item">
              <Col className="col-item"  span="4">
                <label>检查返回json:&nbsp;<Tooltip title={'检查接口返回数据字段值，比如检查 code 是不是等于 0'}>
                  <Icon type="question-circle-o" style={{ width: '10px' }} />
                </Tooltip></label>
              </Col>
              <Col  className="col-item" span="6">
                <Input value={this.state.commonSetting.checkResponseField.name} onChange={this.changeCommonFieldSetting('name')} placeholder="字段名"  />
              </Col>
              <Col  className="col-item" span="6">
                <Input  onChange={this.changeCommonFieldSetting('value')}  value={this.state.commonSetting.checkResponseField.value}   placeholder="值"  />
              </Col>
              <Col  className="col-item" span="6">
                <Switch  onChange={this.changeCommonFieldSetting('enable')}  checked={this.state.commonSetting.checkResponseField.enable}  checkedChildren="开" unCheckedChildren="关"  />
              </Col>
            </Row>

            <Row className="setting-item">
              <Col className="col-item" span="4">
                <label>检查返回数据结构:&nbsp;<Tooltip title={'只有 response 基于 json-schema 方式定义，该检查才会生效'}>
                  <Icon type="question-circle-o" style={{ width: '10px' }} />
                </Tooltip></label>
              </Col>
              <Col className="col-item"  span="18">
                <Switch onChange={e=>{
                  let {commonSetting} = this.state;
                  this.setState({
                    commonSetting :{
                      ...commonSetting,
                      checkResponseSchema: e
                    }
                  })
                }} checked={this.state.commonSetting.checkResponseSchema}  checkedChildren="开" unCheckedChildren="关" />
              </Col>
            </Row>

            <Row className="setting-item">
              <Col className="col-item  " span="4">
                <label>全局测试脚本:&nbsp;<Tooltip title={'在跑自动化测试时，优先调用全局脚本，只有全局脚本通过测试，才会开始跑case自定义的测试脚本'}>
                  <Icon type="question-circle-o" style={{ width: '10px' }} />
                </Tooltip></label>
              </Col>
              <Col className="col-item"  span="14">
                <div><Switch onChange={e=>{
                  let {commonSetting} = this.state;
                  this.setState({
                    commonSetting :{
                      ...commonSetting,
                      checkScript: {
                        ...this.state.checkScript,
                        enable: e
                      }
                    }
                  })
                }} checked={this.state.commonSetting.checkScript.enable}  checkedChildren="开" unCheckedChildren="关"  /></div>
                <AceEditor
                  onChange={this.onChangeTest}
                  className="case-script"
                  data={this.state.commonSetting.checkScript.content}
                  ref={aceEditor => {
                    this.aceEditor = aceEditor;
                  }}
                />
              </Col>
              <Col span="6">
                <div className="insert-code">
                  {InsertCodeMap.map(item => {
                    return (
                      <div
                        style={{ cursor: 'pointer' }}
                        className="code-item"
                        key={item.title}
                        onClick={() => {
                          this.handleInsertCode('\n' + item.code);
                        }}
                      >
                        {item.title}
                      </div>
                    );
                  })}
                </div>
              </Col>
            </Row>


          </div>
        </Modal>
        <Row type="flex" justify="center" align="top">
          <Col span={5}>
            <h2
              className="interface-title"
              style={{
                display: 'inline-block',
                margin: '8px 20px 16px 0px'
              }}
            >
              测试集合&nbsp;<a
                target="_blank"
                rel="noopener noreferrer"
                href="https://hellosean1025.github.io/yapi/documents/case.html"
              >
                <Tooltip title="点击查看文档">
                  <Icon type="question-circle-o" />
                </Tooltip>
              </a>
            </h2>
          </Col>
          <Col span={10}>
            <CaseEnv
              envList={this.props.envList}
              currProjectEnvChange={this.currProjectEnvChange}
              envValue={this.state.currColEnvObj}
              collapseKey={this.state.collapseKey}
              changeClose={this.changeCollapseClose}
            />
          </Col>
          <Col span={9}>
            <div
              style={{
                float: 'right',
                paddingTop: '8px'
              }}
            >
              {this.props.curProjectRole !== 'guest' && (
                <>
                  <Tooltip title="在 ApiMind 服务端运行自动化测试；请确保服务端能够访问目标测试环境">
                    <Button
                      style={{
                        marginRight: '8px'
                      }}
                      onClick={this.autoTests}
                    >
                      服务端测试
                    </Button>
                  </Tooltip>
                  <Button onClick={this.openCommonSetting}>通用规则配置</Button>
                </>
              )}
            </div>
          </Col>
        </Row>

        <div className="component-label-wrapper">
          <Label onChange={val => this.handleChangeInterfaceCol(val, col_name)} desc={col_desc} />
        </div>

        <AntTable
          className="interface-col-table-body"
          columns={columns}
          dataSource={rows}
          rowKey="_id"
          pagination={false}
        />
        <Modal
          title="测试报告"
          width="900px"
          style={{
            minHeight: '500px'
          }}
          open={this.state.visible}
          onCancel={this.handleCancel}
          footer={null}
        >
          <CaseReport {...this.reports[this.state.curCaseid]} />
        </Modal>

        <Modal
          title="自定义测试脚本"
          width="660px"
          style={{
            minHeight: '500px'
          }}
          open={this.state.advVisible}
          onCancel={this.handleAdvCancel}
          onOk={this.handleAdvOk}
          maskClosable={false}
        >
          <h3>
            是否开启:&nbsp;
            <Switch
              checked={this.state.enableScript}
              onChange={e => this.setState({ enableScript: e })}
            />
          </h3>
          <AceEditor
            className="case-script"
            data={this.state.curScript}
            onChange={this.handleScriptChange}
          />
        </Modal>
        {this.state.autoVisible && (
          <Modal
            title="服务端自动化测试"
            width="780px"
            style={{
              minHeight: '500px'
            }}
            open={this.state.autoVisible}
            onCancel={this.handleAuto}
            className="autoTestsModal"
            footer={null}
          >
            <Row type="flex" justify="space-around" className="row" align="top">
              <Col span={3} className="label" style={{ paddingTop: '16px' }}>
                选择环境
                <Tooltip title="默认使用测试用例选择的环境">
                  <Icon type="question-circle-o" />
                </Tooltip>
                &nbsp;：
              </Col>
              <Col span={21}>
                <CaseEnv
                  envList={this.props.envList}
                  currProjectEnvChange={this.currProjectEnvChange}
                  envValue={this.state.currColEnvObj}
                  collapseKey={this.state.collapseKey}
                  changeClose={this.changeCollapseClose}
                />
              </Col>
            </Row>
            <Row type="flex" justify="space-around" className="row" align="middle">
              <Col span={3} className="label">
                输出格式：
              </Col>
              <Col span={21}>
                <Select value={this.state.mode} onChange={this.modeChange}>
                  <Option key="html" value="html">
                    html
                  </Option>
                  <Option key="json" value="json">
                    json
                  </Option>
                </Select>
              </Col>
            </Row>
            <Row type="flex" justify="space-around" className="row" align="middle">
              <Col span={3} className="label">
                消息通知
                <Tooltip title={'测试不通过时，会给项目组成员发送消息通知'}>
                  <Icon
                    type="question-circle-o"
                    style={{
                      width: '10px'
                    }}
                  />
                </Tooltip>
                &nbsp;：
              </Col>
              <Col span={21}>
                <Switch
                  checked={this.state.email}
                  checkedChildren="开"
                  unCheckedChildren="关"
                  onChange={this.emailChange}
                />
              </Col>
            </Row>
            <Row type="flex" justify="space-around" className="row" align="middle">
              <Col span={3} className="label">
                下载数据
                <Tooltip title={'开启后，测试数据将被下载到本地'}>
                  <Icon
                    type="question-circle-o"
                    style={{
                      width: '10px'
                    }}
                  />
                </Tooltip>
                &nbsp;：
              </Col>
              <Col span={21}>
                <Switch
                  checked={this.state.download}
                  checkedChildren="开"
                  unCheckedChildren="关"
                  onChange={this.downloadChange}
                />
              </Col>
            </Row>
            <Row type="flex" justify="space-around" className="row" align="middle">
              <Col span={21} className="autoTestUrl">
                <a 
                  target="_blank"
                  rel="noopener noreferrer"
                  href={localUrl + autoTestsUrl} >
                  {autoTestsUrl}
                </a>
              </Col>
              <Col span={3}>
                <Button className="copy-btn" onClick={() => this.copyUrl(localUrl + autoTestsUrl)}>
                  复制
                </Button>
              </Col>
            </Row>
            <div className="autoTestMsg">
              注：访问该URL，可以测试所有用例，请确保YApi服务器可以访问到环境配置的 domain
            </div>
          </Modal>
        )}
      </div>
    );
  }
}

export default InterfaceColContent;
