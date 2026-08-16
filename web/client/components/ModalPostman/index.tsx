import React, { Component } from 'react';
import type { ReactNode } from 'react';
import PropTypes from 'prop-types';
import './index.scss';
import { Alert, Modal, Row, Col, Input, Tooltip } from 'antd';
import Icon from 'client/shims/antdIcon';
import Collapse from 'client/shims/Collapse';
import MockList from './MockList';
import MethodsList from './MethodsList';
import VariablesSelect from './VariablesSelect';
import { trim } from '../../common';

import { handleParamsValue } from 'common/utils.js';
const Panel = Collapse.Panel;

// 深拷贝
interface MethodParam {
  name: string;
  params: string[];
  type?: 'dataSource';
}
interface ModalPostmanProps {
  visible?: boolean;
  handleCancel: () => void;
  handleOk: (value: string) => void;
  inputValue?: string;
  envType?: string;
  id: number;
}
interface ModalPostmanState {
  methodsShow: boolean;
  methodsShowMore: boolean;
  methodsList: unknown[];
  constantInput: string;
  activeKey: string | string[];
  methodsParamsList: MethodParam[];
}
interface MethodsListSourceProps {
  index: number;
  value: string;
  params: string[];
}

function deepEqual<T>(state: T): T {
  return JSON.parse(JSON.stringify(state));
}

function closeRightTabsAndAddNewTab(
  arr: MethodParam[],
  index: number,
  name?: string,
  params?: string[]
): MethodParam[] {
  const newParamsList = ([] as MethodParam[]).concat(arr);
  newParamsList.splice(index + 1, newParamsList.length - index);
  newParamsList.push({
    name: '',
    params: []
  });

  let curParams = params || [];
  let curname = name || '';
  newParamsList[index] = {
    ...newParamsList[index],
    name: curname,
    params: curParams
  };
  return newParamsList;
}

class ModalPostman extends Component<ModalPostmanProps, ModalPostmanState> {
  static propTypes = {
    visible: PropTypes.bool,
    handleCancel: PropTypes.func,
    handleOk: PropTypes.func,
    inputValue: PropTypes.string,
    envType: PropTypes.string,
    id: PropTypes.number
  };

  constructor(props: ModalPostmanProps) {
    super(props);
    this.state = {
      methodsShow: false,
      methodsShowMore: false,
      methodsList: [],
      constantInput: '',
      activeKey: '1',
      methodsParamsList: [
        {
          name: '',
          params: [],
          type: 'dataSource'
        }
      ]
    };
  }

  componentWillMount() {
    let { inputValue } = this.props;
    this.setState({
      constantInput: inputValue || ''
    });
    // this.props.inputValue && this.handleConstantsInput(this.props.inputValue, 0);
    inputValue && this.handleInitList(inputValue);
  }

  handleInitList(val: string) {
    val = val.replace(/^\{\{(.+)\}\}$/g, '$1');
    let valArr = val.split('|');

    if (valArr[0].indexOf('@') >= 0) {
      this.setState({
        activeKey: '2'
      });
    } else if (valArr[0].indexOf('$') >= 0) {
      this.setState({
        activeKey: '3'
      });
    }

    const paramsList: MethodParam[] = [
      {
        name: String(trim(valArr[0]) || ''),
        params: [],
        type: 'dataSource'
      }
    ];

    for (let i = 1; i < valArr.length; i++) {
      let nameArr = valArr[i].split(':');

      let paramArr = nameArr[1] && nameArr[1].split(',');
      paramArr =
        paramArr &&
        paramArr.map(item => {
          return String(trim(item) || '');
        });
      let item = {
        name: String(trim(nameArr[0]) || ''),
        params: paramArr || []
      };
      paramsList.push(item);
    }

    this.setState(
      {
        methodsParamsList: paramsList
      },
      () => {
        this.mockClick(valArr.length)();
      }
    );
  }

  mockClick(index: number) {
    return (curname?: string, params?: string[]) => {
      let newParamsList = closeRightTabsAndAddNewTab(
        this.state.methodsParamsList,
        index,
        curname,
        params
      );
      this.setState({
        methodsParamsList: newParamsList
      });
    };
  }
  //  处理常量输入
  handleConstantsInput = (val: string) => {
    val = val.replace(/^\{\{(.+)\}\}$/g, '$1');
    this.setState({
      constantInput: val
    });
    this.mockClick(0)(val);
  };

  handleParamsInput = (e: string, clickIndex: number, paramsIndex: number) => {
    let newParamsList = deepEqual(this.state.methodsParamsList);
    newParamsList[clickIndex].params[paramsIndex] = e;
    this.setState({
      methodsParamsList: newParamsList
    });
  };

  // 方法
  MethodsListSource = (props: MethodsListSourceProps) => {
    return (
      <MethodsList
        click={this.mockClick(props.index)}
        clickValue={props.value}
        params={props.params}
        paramsInput={this.handleParamsInput}
        clickIndex={props.index}
      />
    );
  };

  //  处理表达式
  handleValue(val: string): ReactNode {
    return handleParamsValue(val, {}) as ReactNode;
  }

  // 处理错误
  handleError() {
    return (
      <Alert
        message="请求“变量集”尚未运行,所以我们无法从其响应中提取的值。您可以在测试集合中测试这些变量。"
        type="warning"
      />
    );
  }

  // 初始化
  setInit() {
    const initParamsList: MethodParam[] = [
      {
        name: '',
        params: [],
        type: 'dataSource'
      }
    ];
    this.setState({
      methodsParamsList: initParamsList
    });
  }
  // 处理取消插入
  handleCancel = () => {
    this.setInit();
    this.props.handleCancel();
  };

  // 处理插入
  handleOk = (installValue: string) => {
    this.props.handleOk(installValue);
    this.setInit();
  };
  // 处理面板切换
  handleCollapse = (key: string | string[]) => {
    this.setState({
      activeKey: key
    });
  };

  render() {
    const { visible, envType } = this.props;
    const { methodsParamsList, constantInput } = this.state;

    const outputParams = () => {
      let str = '';
      let length = methodsParamsList.length;
      methodsParamsList.forEach((item, index) => {
        let isShow = item.name && length - 2 !== index;
        str += item.name;
        item.params.forEach((item, index) => {
          let isParams = index > 0;
          str += isParams ? ' , ' : ' : ';
          str += item;
        });
        str += isShow ? ' | ' : '';
      });
      return '{{ ' + str + ' }}';
    };

    return (
      <Modal
        title={
          <p>
            <Icon type="edit" /> 高级参数设置
          </p>
        }
        open={visible}
        onOk={() => this.handleOk(outputParams())}
        onCancel={this.handleCancel}
        wrapClassName="modal-postman"
        width={1024}
        maskClosable={false}
        okText="插入"
      >
        <Row className="modal-postman-form" type="flex">
          {methodsParamsList.map((item, index) => {
            return item.type === 'dataSource' ? (
              <Col span={8} className="modal-postman-col" key={index}>
                <Collapse
                  className="modal-postman-collapse"
                  activeKey={this.state.activeKey}
                  onChange={this.handleCollapse}
                  bordered={false}
                  accordion
                >
                  <Panel header={<h3 className="mock-title">常量</h3>} key="1">
                    <Input
                      placeholder="基础参数值"
                      value={constantInput}
                      onChange={e => this.handleConstantsInput(e.target.value)}
                    />
                  </Panel>
                  <Panel header={<h3 className="mock-title">mock数据</h3>} key="2">
                    <MockList click={this.mockClick(index)} clickValue={item.name} />
                  </Panel>
                  {envType === 'case' && (
                    <Panel
                      header={
                        <h3 className="mock-title">
                          变量&nbsp;<Tooltip
                            placement="top"
                            title="YApi 提供了强大的变量参数功能，你可以在测试的时候使用前面接口的 参数 或 返回值 作为 后面接口的参数，即使接口之间存在依赖，也可以轻松 一键测试~"
                          >
                            <Icon type="question-circle-o" />
                          </Tooltip>
                        </h3>
                      }
                      key="3"
                    >
                      <VariablesSelect
                        id={this.props.id}
                        click={this.mockClick(index)}
                        clickValue={item.name}
                      />
                    </Panel>
                  )}
                </Collapse>
              </Col>
            ) : (
              <Col span={8} className="modal-postman-col" key={index}>
                <this.MethodsListSource index={index} value={item.name} params={item.params} />
              </Col>
            );
          })}
        </Row>
        <Row className="modal-postman-expression">
          <Col span={6}>
            <h3 className="title">表达式</h3>
          </Col>
          <Col span={18}>
            <span className="expression-item">{outputParams()}</span>
          </Col>
        </Row>
        <Row className="modal-postman-preview">
          <Col span={6}>
            <h3 className="title">预览</h3>
          </Col>
          <Col span={18}>
            <h3>{this.handleValue(outputParams()) || (outputParams() && this.handleError())}</h3>
          </Col>
        </Row>
      </Modal>
    );
  }
}

export default ModalPostman;
