import React, { PureComponent as Component } from 'react';
import type { ChangeEventHandler, MouseEventHandler } from 'react';
import PropTypes from 'prop-types';
import { Button, Input, Checkbox, Modal, Select, Spin, Tooltip, Tabs, Switch, Row, Col, Alert } from 'antd';
import Icon from 'client/shims/antdIcon';
import Collapse from 'client/shims/Collapse';
import constants from '../../constants/variable.js';
import AceEditor from 'client/components/AceEditor/AceEditor';
import _ from 'underscore';
import { deepCopyJson } from '../../common';
import axios from 'axios';
import ModalPostman from '../ModalPostman';
import './Postman.scss';
import ProjectEnv from '../../containers/Project/Setting/ProjectEnv';
import json5 from 'json5';
import { handleParamsValue, ArrayToObject } from 'common/utils.js';
import {
  checkRequestBodyIsRaw,
  checkNameIsExistInArray,
  handleContentType
} from 'common/postmanLib.js';
import type { HttpMethod } from '../../types/runtime';
import type { UnknownRecord } from '../../reducer/types/runtime';
import type { MockEditorData } from '../AceEditor/mockEditor';
import { createSchemaPreviewRequest } from '../../containers/Project/Interface/InterfaceList/requestContracts';
import type { ProjectEnvironment } from '../../containers/Project/Setting/ProjectEnv/ProjectEnvContent';

const HTTP_METHOD = constants.HTTP_METHOD;
const InputGroup = Input.Group;
const Option = Select.Option;
const Panel = Collapse.Panel;

export const InsertCodeMap = [
  {
    code: 'assert.equal(status, 200)',
    title: '断言 httpCode 等于 200'
  },
  {
    code: 'assert.equal(body.code, 0)',
    title: '断言返回数据 code 是 0'
  },
  {
    code: 'assert.notEqual(status, 404)',
    title: '断言 httpCode 不是 404'
  },
  {
    code: 'assert.notEqual(body.code, 40000)',
    title: '断言返回数据 code 不是 40000'
  },
  {
    code: 'assert.deepEqual(body, {"code": 0})',
    title: '断言对象 body 等于 {"code": 0}'
  },
  {
    code: 'assert.notDeepEqual(body, {"code": 0})',
    title: '断言对象 body 不等于 {"code": 0}'
  }
];

interface ParamsNameProps { example?: string; desc?: string; name?: string }
const ParamsNameComponent = (props: ParamsNameProps) => {
  const { example, desc, name } = props;
  const isNull = !example && !desc;
  const TooltipTitle = () => {
    return (
      <div>
        {example && (
          <div>
            示例： <span className="table-desc">{example}</span>
          </div>
        )}
        {desc && (
          <div>
            备注： <span className="table-desc">{desc}</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      {isNull ? (
        <Input disabled value={name} className="key" />
      ) : (
        <Tooltip placement="topLeft" title={<TooltipTitle />}>
          <Input disabled value={name} className="key" />
        </Tooltip>
      )}
    </div>
  );
};
ParamsNameComponent.propTypes = {
  example: PropTypes.string,
  desc: PropTypes.string,
  name: PropTypes.string
};
interface RequestParam extends UnknownRecord {
  name: string; value?: string | boolean; example?: string; desc?: string; type?: string;
  required?: number; enable?: boolean; abled?: boolean;
}
type Environment = ProjectEnvironment & UnknownRecord;
export interface RunData extends UnknownRecord {
  _id: string | number; project_id: number; interface_up_time?: number; method: HttpMethod; path?: string;
  req_params: RequestParam[]; req_headers: RequestParam[]; req_query: RequestParam[]; req_body_form: RequestParam[];
  req_body_type?: string; req_body_other?: string; req_body_is_json_schema?: boolean;
  case_env?: string; env: Environment[]; enable_script?: boolean; test_script?: string;
}
interface RunProps { data: RunData; save?: MouseEventHandler<HTMLElement>; saveTip?: string; type: 'case' | 'inter'; curUid: number; interfaceId: number; projectId: number }
type ParamArrayKey = 'req_params' | 'req_headers' | 'req_query' | 'req_body_form';
interface RunState extends RunData {
  loading: boolean; resStatusCode: number | null; test_valid_msg: string | null; resStatusText: string | null;
  mock_verify: boolean; inputValue: string; cursurPosition: number | { row: number; column: number };
  envModalVisible: boolean; modalVisible?: boolean; modalType?: ParamArrayKey | 'req_body_other'; inputIndex?: number;
  test_res_header: Record<string, string> | null; test_res_body: unknown; autoPreviewHTML: boolean;
}
interface Run {
  changePath?: ChangeEventHandler<HTMLInputElement>;
  addPathParam?: MouseEventHandler<HTMLElement>;
  addQuery?: MouseEventHandler<HTMLElement>;
  addHeader?: MouseEventHandler<HTMLElement>;
  addBody?: MouseEventHandler<HTMLElement>;
}
class Run extends Component<RunProps, RunState> {
  aceEditor: AceEditor | null = null;
  static propTypes = {
    data: PropTypes.object, //接口原有数据
    save: PropTypes.func, //保存回调方法
    type: PropTypes.string, //enum[case, inter], 判断是在接口页面使用还是在测试集
    curUid: PropTypes.number.isRequired,
    interfaceId: PropTypes.number.isRequired,
    projectId: PropTypes.number.isRequired
  };

  constructor(props: RunProps) {
    super(props);
    this.state = {
      loading: false,
      resStatusCode: null,
      test_valid_msg: null,
      resStatusText: null,
      case_env: '',
      mock_verify: false,
      enable_script: false,
      test_script: '',
      inputValue: '',
      cursurPosition: { row: 1, column: -1 },
      envModalVisible: false,
      test_res_header: null,
      test_res_body: null,
      autoPreviewHTML: true,
      ...this.props.data
    };
  }

  get testResponseBodyIsHTML() {
    const hd = this.state.test_res_header;
    return (
      hd != null &&
      typeof hd === 'object' &&
      String(hd['Content-Type'] || hd['content-type']).indexOf('text/html') !== -1
    );
  }

  checkInterfaceData(data: unknown): data is RunData {
    if (!data || typeof data !== 'object' || !('_id' in data) || !data._id) {
      return false;
    }
    return true;
  }

  // 整合header信息
  handleReqHeader = (value: string, env: Environment[]) => {
    let index = value
        ? env.findIndex((item: Environment) => {
          return item.name === value;
        })
      : 0;
    index = index === -1 ? 0 : index;

    let req_header: RequestParam[] = (this.props.data.req_headers || []).slice();
    let header = (env[index]?.header || []).slice() as unknown as RequestParam[];
    header.forEach((item: RequestParam) => {
      if (!checkNameIsExistInArray(item.name, req_header)) {
        item = {
          ...item,
          abled: true
        };
        req_header.push(item);
      }
    });
    req_header = req_header.filter((item: RequestParam) => {
      return item && typeof item === 'object';
    });
    return req_header;
  };

  selectDomain = (value: string) => {
    let headers = this.handleReqHeader(value, this.state.env);
    this.setState({
      case_env: value,
      req_headers: headers
    });
  };

  async initState(data: RunData) {
    if (!this.checkInterfaceData(data)) {
      return null;
    }

    const { req_body_other, req_body_type, req_body_is_json_schema } = data;
    let body = req_body_other;
    // 运行时才会进行转换
    if (
      this.props.type === 'inter' &&
      req_body_type === 'json' &&
      req_body_other &&
      req_body_is_json_schema
    ) {
      let schema = {};
      try {
        schema = json5.parse(req_body_other);
      } catch (e) {
        console.log('e', e);
        return;
      }
      const request = createSchemaPreviewRequest(schema);
      let result = await axios.post(request.url, {
        ...request.body,
        required: true
      });
      body = JSON.stringify(result.data);
    }

    let example = {}
    if(this.props.type === 'inter'){
      example = (['req_headers', 'req_query', 'req_body_form'] as ParamArrayKey[]).reduce(
        (res: Partial<Pick<RunData, ParamArrayKey>>, key: ParamArrayKey) => {
          res[key] = (data[key] || []).map((item: RequestParam) => {
            if (
              item.type !== 'file' // 不是文件类型
                && (item.value == null || item.value === '') // 初始值为空
                && item.example != null // 有示例值
            ) {
              item.value = item.example;
            }
            return item;
          })
          return res;
        },
        {} as Partial<Pick<RunData, ParamArrayKey>>
      )
    }

    this.setState(
      {
        ...this.state,
        test_res_header: null,
        test_res_body: null,
        ...data,
        ...example,
        req_body_other: body,
        resStatusCode: null,
        test_valid_msg: null,
        resStatusText: null
      },
      () => this.props.type === 'inter' && this.initEnvState(data.case_env || '', data.env)
    );
  }

  initEnvState(case_env: string, env: Environment[]) {
    let headers = this.handleReqHeader(case_env, env);

    this.setState(
      {
        req_headers: headers,
        env: env
      },
      () => {
        let s = !_.find(env, (item: Environment) => item.name === this.state.case_env);
        if (!this.state.case_env || s) {
          this.setState({
            case_env: this.state.env[0].name
          });
        }
      }
    );
  }

  componentWillMount() {
    this.initState(this.props.data);
  }

  componentWillReceiveProps(nextProps: RunProps) {
    if (this.checkInterfaceData(nextProps.data) && this.checkInterfaceData(this.props.data)) {
      if (nextProps.data._id !== this.props.data._id) {
        this.initState(nextProps.data);
      } else if (nextProps.data.interface_up_time !== this.props.data.interface_up_time) {
        this.initState(nextProps.data);
      }
      if (nextProps.data.env !== this.props.data.env) {
        this.initEnvState(this.state.case_env || '', nextProps.data.env);
      }
    }
  }

  handleValue(val: unknown, global: Array<{ name: string; value: unknown }>) {
    let globalValue = ArrayToObject(global);
    return handleParamsValue(val, {
      global: globalValue
    });
  }

  onOpenTest = (d: MockEditorData) => {
    this.setState({
      test_script: d.text
    });
  };

  handleInsertCode = (code: string) => {
    this.aceEditor?.editor?.insertCode(code);
  };

  handleRequestBody = (d: MockEditorData) => {
    this.setState({
      req_body_other: d.text
    });
  };

  changeParam = (name: ParamArrayKey, v: string | boolean, index: number, key: 'value' | 'enable' = 'value') => {
    
    key = key || 'value';
    const pathParam = deepCopyJson(this.state[name]);

    if (key === 'enable') {
      pathParam[index].enable = Boolean(v);
    } else {
      pathParam[index].value = v;
      pathParam[index].enable = !!v;
    }
    this.setState({ [name]: pathParam } as Pick<RunState, ParamArrayKey>);
  };

  changeBody = (v: string | boolean, index: number, key: 'value' | 'enable' = 'value') => {
    const bodyForm = deepCopyJson(this.state.req_body_form);
    key = key || 'value';
    if (key === 'value') {
      bodyForm[index].enable = !!v;
      if (bodyForm[index].type === 'file') {
        bodyForm[index].value = 'file_' + index;
      } else {
        bodyForm[index].value = v;
      }
    } else if (key === 'enable') {
      bodyForm[index].enable = Boolean(v);
    }
    this.setState({ req_body_form: bodyForm });
  };

  // 模态框的相关操作
  showModal = (val: string | boolean | undefined, index: number, type: ParamArrayKey | 'req_body_other') => {
    let inputValue = '';
    let cursurPosition;
    if (type === 'req_body_other') {
      // req_body
      let editor = this.aceEditor?.editor?.editor;
      if (!editor) return;
      cursurPosition = editor.session.doc.positionToIndex(editor.selection.getCursor(), 0);
      // 获取选中的数据
      inputValue = this.getInstallValue(String(val || ''), cursurPosition).val;
    } else {
      // 其他input 输入
      let oTxt1 = document.getElementById(`${type}_${index}`) as HTMLInputElement | null;
      cursurPosition = oTxt1?.selectionStart || 0;
      inputValue = this.getInstallValue(String(val || ''), cursurPosition).val;
      // cursurPosition = {row: 1, column: position}
    }

    this.setState({
      modalVisible: true,
      inputIndex: index,
      inputValue,
      cursurPosition,
      modalType: type
    });
  };

  // 点击插入
  handleModalOk = (val: string) => {
    const { inputIndex, modalType } = this.state;
    if (modalType === 'req_body_other') {
      this.changeInstallBody(modalType, val);
    } else {
      if (modalType) this.changeInstallParam(modalType, val, inputIndex || 0);
    }

    this.setState({ modalVisible: false });
  };

  // 根据鼠标位置往req_body中动态插入数据
  changeInstallBody = (type: 'req_body_other', value: string) => {
    const pathParam = deepCopyJson(this.state[type]);
    // console.log(pathParam)
    let oldValue = pathParam || '';
    let newValue = this.getInstallValue(oldValue, typeof this.state.cursurPosition === 'number' ? this.state.cursurPosition : -1);
    let left = newValue.left;
    let right = newValue.right;
    this.setState({
      [type]: `${left}${value}${right}`
    });
  };

  // 获取截取的字符串
  getInstallValue = (oldValue: string, cursurPosition: number) => {
    let left = oldValue.substr(0, cursurPosition);
    let right = oldValue.substr(cursurPosition);

    let leftPostion = left.lastIndexOf('{{');
    let leftPostion2 = left.lastIndexOf('}}');
    let rightPostion = right.indexOf('}}');
    // console.log(leftPostion, leftPostion2,rightPostion, rightPostion2);
    let val = '';
    // 需要切除原来的变量
    if (leftPostion !== -1 && rightPostion !== -1 && leftPostion > leftPostion2) {
      left = left.substr(0, leftPostion);
      right = right.substr(rightPostion + 2);
      val = oldValue.substring(leftPostion, cursurPosition + rightPostion + 2);
    }
    return {
      left,
      right,
      val
    };
  };

  // 根据鼠标位置动态插入数据
  changeInstallParam = (name: ParamArrayKey, v: string, index: number, key: 'value' = 'value') => {
    key = key || 'value';
    const pathParam = deepCopyJson(this.state[name]);
    let oldValue = pathParam[index][key] || '';
    let newValue = this.getInstallValue(String(oldValue), typeof this.state.cursurPosition === 'number' ? this.state.cursurPosition : -1);
    let left = newValue.left;
    let right = newValue.right;
    pathParam[index].value = `${left}${v}${right}`;
    this.setState({ [name]: pathParam } as Pick<RunState, ParamArrayKey>);
  };

  // 取消参数插入
  handleModalCancel = () => {
    this.setState({ modalVisible: false, cursurPosition: -1 });
  };

  // 环境变量模态框相关操作
  showEnvModal = () => {
    this.setState({
      envModalVisible: true
    });
  };

  handleEnvOk = (newEnv: ProjectEnvironment[], index: number) => {
    this.setState({
      envModalVisible: false,
      case_env: newEnv[index].name
    });
  };

  handleEnvCancel = () => {
    this.setState({
      envModalVisible: false
    });
  };

  render() {
    const {
      method,
      env,
      path,
      req_params = [],
      req_headers = [],
      req_query = [],
      req_body_type,
      req_body_form = [],
      case_env,
      inputValue
    } = this.state;
    // console.log(env);
    return (
      <div className="interface-test postman">
        {this.state.modalVisible && (
          <ModalPostman
            visible={this.state.modalVisible}
            handleCancel={this.handleModalCancel}
            handleOk={this.handleModalOk}
            inputValue={inputValue}
            envType={this.props.type}
            id={+this.state._id}
          />
        )}

        {this.state.envModalVisible && (
          <Modal
            title="环境设置"
            open={this.state.envModalVisible}
            onOk={this.handleEnvOk as unknown as MouseEventHandler<HTMLButtonElement>}
            onCancel={this.handleEnvCancel}
            footer={null}
            width={800}
            className="env-modal"
          >
            <ProjectEnv projectId={this.props.data.project_id} onOk={this.handleEnvOk} />
          </Modal>
        )}
        <div className="url">
          <InputGroup compact style={{ display: 'flex' }}>
            <Select disabled value={method} style={{ flexBasis: 60 }}>
              {Object.keys(HTTP_METHOD).map(() => null)}
            </Select>
            <Select
              value={case_env}
              style={{ flexBasis: 180, flexGrow: 1 }}
              onSelect={this.selectDomain}
            >
              {env.map((item, index) => (
                <Option value={item.name} key={index}>
                  {item.name + '：' + item.domain}
                </Option>
              ))}
              <Option value="环境配置" disabled style={{ cursor: 'pointer', color: '#2395f1' }}>
                <Button type="primary" onClick={this.showEnvModal}>
                  环境配置
                </Button>
              </Option>
            </Select>

            <Input
              disabled
              value={path}
              onChange={this.changePath}
              spellCheck="false"
              style={{ flexBasis: 180, flexGrow: 1 }}
            />
          </InputGroup>

          <Tooltip
            placement="bottom"
            title={() => {
              return this.props.type === 'inter' ? '保存到测试集' : '更新该用例';
            }}
          >
            <Button onClick={this.props.save} type="primary" style={{ marginLeft: 10 }}>
              {this.props.type === 'inter' ? '保存' : '更新'}
            </Button>
          </Tooltip>
        </div>

        <Collapse defaultActiveKey={['0', '1', '2', '3']} bordered={true}>
          <Panel
            header="PATH PARAMETERS"
            key="0"
            className={req_params.length === 0 ? 'hidden' : ''}
          >
            {req_params.map((item, index) => {
              return (
                <div key={index} className="key-value-wrap">
                  {/* <Tooltip
                    placement="topLeft"
                    title={<TooltipContent example={item.example} desc={item.desc} />}
                  >
                    <Input disabled value={item.name} className="key" />
                  </Tooltip> */}
                  <ParamsNameComponent example={item.example} desc={item.desc} name={item.name} />
                  <span className="eq-symbol">=</span>
                  <Input
                    value={typeof item.value === 'boolean' ? String(item.value) : item.value}
                    className="value"
                    onChange={e => this.changeParam('req_params', e.target.value, index)}
                    placeholder="参数值"
                    id={`req_params_${index}`}
                    addonAfter={
                      <Icon
                        type="edit"
                        onClick={() => this.showModal(item.value, index, 'req_params')}
                      />
                    }
                  />
                </div>
              );
            })}
            <Button
              style={{ display: 'none' }}
              type="primary"
              icon={<Icon type="plus" />}
              onClick={this.addPathParam}
            >
              添加Path参数
            </Button>
          </Panel>
          <Panel
            header="QUERY PARAMETERS"
            key="1"
            className={req_query.length === 0 ? 'hidden' : ''}
          >
            {req_query.map((item, index) => {
              return (
                <div key={index} className="key-value-wrap">
                  {/* <Tooltip
                    placement="topLeft"
                    title={<TooltipContent example={item.example} desc={item.desc} />}
                  >
                    <Input disabled value={item.name} className="key" />
                  </Tooltip> */}
                  <ParamsNameComponent example={item.example} desc={item.desc} name={item.name} />
                  &nbsp;
                  {item.required == 1 ? (
                    <Checkbox className="params-enable" checked={true} disabled />
                  ) : (
                    <Checkbox
                      className="params-enable"
                      checked={item.enable}
                      onChange={e =>
                        this.changeParam('req_query', e.target.checked, index, 'enable')
                      }
                    />
                  )}
                  <span className="eq-symbol">=</span>
                  <Input
                    value={typeof item.value === 'boolean' ? String(item.value) : item.value}
                    className="value"
                    onChange={e => this.changeParam('req_query', e.target.value, index)}
                    placeholder="参数值"
                    id={`req_query_${index}`}
                    addonAfter={
                      <Icon
                        type="edit"
                        onClick={() => this.showModal(item.value, index, 'req_query')}
                      />
                    }
                  />
                </div>
              );
            })}
            <Button style={{ display: 'none' }} type="primary" icon={<Icon type="plus" />} onClick={this.addQuery}>
              添加Query参数
            </Button>
          </Panel>
          <Panel header="HEADERS" key="2" className={req_headers.length === 0 ? 'hidden' : ''}>
            {req_headers.map((item, index) => {
              return (
                <div key={index} className="key-value-wrap">
                  {/* <Tooltip
                    placement="topLeft"
                    title={<TooltipContent example={item.example} desc={item.desc} />}
                  >
                    <Input disabled value={item.name} className="key" />
                  </Tooltip> */}
                  <ParamsNameComponent example={item.example} desc={item.desc} name={item.name} />
                  <span className="eq-symbol">=</span>
                  <Input
                    value={typeof item.value === 'boolean' ? String(item.value) : item.value}
                    disabled={!!item.abled}
                    className="value"
                    onChange={e => this.changeParam('req_headers', e.target.value, index)}
                    placeholder="参数值"
                    id={`req_headers_${index}`}
                    addonAfter={
                      !item.abled && (
                        <Icon
                          type="edit"
                          onClick={() => this.showModal(item.value, index, 'req_headers')}
                        />
                      )
                    }
                  />
                </div>
              );
            })}
            <Button style={{ display: 'none' }} type="primary" icon={<Icon type="plus" />} onClick={this.addHeader}>
              添加Header
            </Button>
          </Panel>
          <Panel
            header={
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Tooltip title="F9 全屏编辑">BODY(F9)</Tooltip>
              </div>
            }
            key="3"
            className={
              HTTP_METHOD[method].request_body &&
              ((req_body_type === 'form' && req_body_form.length > 0) || req_body_type !== 'form')
                ? 'POST'
                : 'hidden'
            }
          >
            <div
              style={{ display: checkRequestBodyIsRaw(method, req_body_type) ? 'block' : 'none' }}
            >
              {req_body_type === 'json' && (
                <div className="adv-button">
                  <Button
                    onClick={() => this.showModal(this.state.req_body_other, 0, 'req_body_other')}
                  >
                    高级参数设置
                  </Button>
                  <Tooltip title="高级参数设置只在json字段值中生效">
                    {'  '}
                    <Icon type="question-circle-o" />
                  </Tooltip>
                </div>
              )}

              <AceEditor
                className="pretty-editor"
                ref={editor => (this.aceEditor = editor)}
                data={this.state.req_body_other}
                mode={req_body_type === 'json' ? undefined : 'text'}
                onChange={this.handleRequestBody}
                fullScreen={true}
              />
            </div>

            {HTTP_METHOD[method].request_body &&
              req_body_type === 'form' && (
                <div>
                  {req_body_form.map((item, index) => {
                    return (
                      <div key={index} className="key-value-wrap">
                        {/* <Tooltip
                          placement="topLeft"
                          title={<TooltipContent example={item.example} desc={item.desc} />}
                        >
                          <Input disabled value={item.name} className="key" />
                        </Tooltip> */}
                        <ParamsNameComponent
                          example={item.example}
                          desc={item.desc}
                          name={item.name}
                        />
                        &nbsp;
                        {item.required == 1 ? (
                          <Checkbox className="params-enable" checked={true} disabled />
                        ) : (
                          <Checkbox
                            className="params-enable"
                            checked={item.enable}
                            onChange={e => this.changeBody(e.target.checked, index, 'enable')}
                          />
                        )}
                        <span className="eq-symbol">=</span>
                        {item.type === 'file' ? (
                          '因Chrome最新版安全策略限制，不再支持文件上传'
                          // <Input
                          //   type="file"
                          //   id={'file_' + index}
                          //   onChange={e => this.changeBody(e.target.value, index, 'value')}
                          //   multiple
                          //   className="value"
                          // />
                        ) : (
                          <Input
                            value={typeof item.value === 'boolean' ? String(item.value) : item.value}
                            className="value"
                            onChange={e => this.changeBody(e.target.value, index)}
                            placeholder="参数值"
                            id={`req_body_form_${index}`}
                            addonAfter={
                              <Icon
                                type="edit"
                                onClick={() => this.showModal(item.value, index, 'req_body_form')}
                              />
                            }
                          />
                        )}
                      </div>
                    );
                  })}
                  <Button
                    style={{ display: 'none' }}
                    type="primary"
                    icon={<Icon type="plus" />}
                    onClick={this.addBody}
                  >
                    添加Form参数
                  </Button>
                </div>
              )}
            {HTTP_METHOD[method].request_body &&
              req_body_type === 'file' && (
                <div>
                  <Input type="file" id="single-file" />
                </div>
              )}
          </Panel>
        </Collapse>

        <Tabs size="large" defaultActiveKey="res" className="response-tab">
          <Tabs.TabPane tab="Response" key="res">
            <Spin spinning={this.state.loading}>
              <h2
                style={{ display: this.state.resStatusCode ? '' : 'none' }}
                className={
                  'res-code ' +
                  (this.state.resStatusCode !== null && this.state.resStatusCode >= 200 &&
                  this.state.resStatusCode < 400 &&
                  !this.state.loading
                    ? 'success'
                    : 'fail')
                }
              >
                {this.state.resStatusCode + '  ' + this.state.resStatusText}
              </h2>
              <div>
                <a rel="noopener noreferrer"  target="_blank" href="https://juejin.im/post/5c888a3e5188257dee0322af">YApi 新版如何查看 http 请求数据</a>
              </div>
              {this.state.test_valid_msg && (
                <Alert
                  message={
                    <span>
                      Warning &nbsp;
                      <Tooltip title="针对定义为 json schema 的返回数据进行格式校验">
                        <Icon type="question-circle-o" />
                      </Tooltip>
                    </span>
                  }
                  type="warning"
                  showIcon
                  description={this.state.test_valid_msg}
                />
              )}

              <div className="container-header-body">
                <div className="header">
                  <div className="container-title">
                    <h4>Headers</h4>
                  </div>
                  <AceEditor
                    callback={editor => {
                      editor.renderer.setShowGutter(false);
                    }}
                    readOnly={true}
                    className="pretty-editor-header"
                    data={this.state.test_res_header}
                    mode="json"
                  />
                </div>
                <div className="resizer">
                  <div className="container-title">
                    <h4 style={{ visibility: 'hidden' }}>1</h4>
                  </div>
                </div>
                <div className="body">
                  <div className="container-title">
                    <h4>Body</h4>
                    <Checkbox
                      checked={this.state.autoPreviewHTML}
                      onChange={e => this.setState({ autoPreviewHTML: e.target.checked })}>
                      <span>自动预览HTML</span>
                    </Checkbox>
                  </div>
                  {
                    this.state.autoPreviewHTML && this.testResponseBodyIsHTML
                      ? <iframe
                          className="pretty-editor-body"
                          srcDoc={typeof this.state.test_res_body === 'string' ? this.state.test_res_body : undefined}
                        />
                      : <AceEditor
                          readOnly={true}
                          className="pretty-editor-body"
                          data={this.state.test_res_body}
                          mode={handleContentType(this.state.test_res_header)}
                      />
                  }
                </div>
              </div>
            </Spin>
          </Tabs.TabPane>
          {this.props.type === 'case' ? (
            <Tabs.TabPane
              className="response-test"
              tab={<Tooltip title="测试脚本，可断言返回结果，使用方法请查看文档">Test</Tooltip>}
              key="test"
            >
              <h3 style={{ margin: '5px' }}>
                &nbsp;是否开启:&nbsp;
                <Switch
                  checked={this.state.enable_script}
                  onChange={e => this.setState({ enable_script: e })}
                />
              </h3>
              <p style={{ margin: '10px' }}>注：Test 脚本只有做自动化测试才执行</p>
              <Row>
                <Col span="18">
                  <AceEditor
                    onChange={this.onOpenTest}
                    className="case-script"
                    data={this.state.test_script}
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
            </Tabs.TabPane>
          ) : null}
        </Tabs>
      </div>
    );
  }
}

export default Run;
