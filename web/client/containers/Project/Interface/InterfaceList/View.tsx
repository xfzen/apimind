import './View.scss';
import React, { PureComponent as Component } from 'react';
import type { ComponentType, ReactNode } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import { Table, Row, Col, Tooltip, message } from 'antd';
import Icon from 'client/shims/antdIcon';
import { Link } from 'react-router-dom';
import AceEditor from 'client/components/AceEditor/AceEditor';
import { formatTime, safeArray } from '../../../../common';
import ErrMsg from '../../../../components/ErrMsg/ErrMsg';
import variable from '../../../../constants/variable';
import constants from '../../../../constants/variable.js';
import copy from 'copy-to-clipboard';
import SchemaTable from '../../../../components/SchemaTable/SchemaTable';
import { buildApiUrl, buildMockUrl } from '../../../../utils/backend';
import { sanitizeHTML } from '../../../../../common/sanitize.js';
import type { ColumnsType } from 'antd/es/table/interface';
import type { RootState } from '../../../../reducer/modules/reducer';
import type { UnknownRecord } from '../../../../reducer/types/runtime';
import { asLegacyClassDecorator } from '../../../../types/legacyDecorators';

const HTTP_METHOD = constants.HTTP_METHOD;

interface ParamItem extends UnknownRecord { name?: string; desc?: string; value?: string; example?: string; required?: number | string; type?: string }
interface ParamRow extends ParamItem { key: number }
interface ViewInterface extends UnknownRecord {
  title?: string; method?: string; path?: string; status: 'done' | 'undone'; desc?: string;
  uid?: string | number; username?: string; up_time?: number; tag?: string[]; custom_field_value?: string;
  req_headers?: ParamItem[]; req_params?: ParamItem[]; req_query?: ParamItem[]; req_body_form?: ParamItem[];
  req_body_type?: string; req_body_other?: string; req_body_is_json_schema?: boolean;
  res_body_type?: string; res_body?: string; res_body_is_json_schema?: boolean;
}
interface ViewProject extends UnknownRecord { _id: string | number; basepath: string; is_mock_open?: boolean; strice?: boolean }
interface ViewProps { curData: ViewInterface; currProject: ViewProject; custom_field: { enable?: boolean; name?: string }; switchToView?: () => void }
interface ViewState { init: boolean; enter: boolean }
const connectView = asLegacyClassDecorator(connect((state: RootState) => {
  return {
    curData: state.inter.curdata,
    custom_field: state.group.field,
    currProject: state.project.currProject
  };
}));
@connectView
class View extends Component<ViewProps, ViewState> {
  constructor(props: ViewProps) {
    super(props);
    this.state = {
      init: true,
      enter: false
    };
  }
  static propTypes = {
    curData: PropTypes.object,
    currProject: PropTypes.object,
    custom_field: PropTypes.object
  };

  req_body_form(req_body_type?: string, req_body_form?: ParamItem[]): ReactNode {
    if (req_body_type === 'form') {
      const columns: ColumnsType<ParamRow> = [
        {
          title: '参数名称',
          dataIndex: 'name',
          key: 'name',
          width: 140
        },
        {
          title: '参数类型',
          dataIndex: 'type',
          key: 'type',
          width: 100,
          render: (text?: string) => {
            text = text || '';
            return text.toLowerCase() === 'text' ? (
              <span>
                <i className="query-icon text">T</i>文本
              </span>
            ) : (
              <span>
                <Icon type="file" className="query-icon" />文件
              </span>
            );
          }
        },
        {
          title: '是否必须',
          dataIndex: 'required',
          key: 'required',
          width: 100
        },
        {
          title: '示例',
          dataIndex: 'example',
          key: 'example',
          width: 80,
          render(_value: unknown, item: ParamRow) {
            return <p style={{ whiteSpace: 'pre-wrap' }}>{item.example}</p>;
          }
        },
        {
          title: '备注',
          dataIndex: 'value',
          key: 'value',
          render(_value: unknown, item: ParamRow) {
            return <p style={{ whiteSpace: 'pre-wrap' }}>{item.value}</p>;
          }
        }
      ];

      const dataSource: ParamRow[] = [];
      if (req_body_form && req_body_form.length) {
        req_body_form.map((item: ParamItem, i: number) => {
          dataSource.push({
            key: i,
            name: item.name,
            value: item.desc,
            example: item.example,
            required: item.required == 0 ? '否' : '是',
            type: item.type
          });
        });
      }

      return (
        <div style={{ display: dataSource.length ? '' : 'none' }} className="colBody">
          <Table
            bordered
            size="small"
            pagination={false}
            columns={columns}
            dataSource={dataSource}
          />
        </div>
      );
    }
  }
  res_body(res_body_type?: string, res_body?: string, res_body_is_json_schema?: boolean): ReactNode {
    if (res_body_type === 'json') {
      if (res_body_is_json_schema) {
        return <SchemaTable dataSource={res_body || ''} />;
      } else {
        return (
          <div className="colBody">
            {/* <div id="vres_body_json" style={{ minHeight: h * 16 + 100 }}></div> */}
            <AceEditor data={res_body} readOnly={true} style={{ minHeight: 600 }} />
          </div>
        );
      }
    } else if (res_body_type === 'raw') {
      return (
        <div className="colBody">
          <AceEditor data={res_body} readOnly={true} mode="text" style={{ minHeight: 300 }} />
        </div>
      );
    }
  }

  req_body(req_body_type?: string, req_body_other?: string, req_body_is_json_schema?: boolean): ReactNode {
    if (req_body_other) {
      if (req_body_is_json_schema && req_body_type === 'json') {
        return <SchemaTable dataSource={req_body_other} />;
      } else {
        return (
          <div className="colBody">
            <AceEditor
              data={req_body_other}
              readOnly={true}
              style={{ minHeight: 300 }}
              mode={req_body_type === 'json' ? 'javascript' : 'text'}
            />
          </div>
        );
      }
    }
  }

  req_query(query?: ParamItem[]) {
    const columns: ColumnsType<ParamRow> = [
      {
        title: '参数名称',
        dataIndex: 'name',
        width: 140,
        key: 'name'
      },
      {
        title: '是否必须',
        width: 100,
        dataIndex: 'required',
        key: 'required'
      },
      {
        title: '示例',
        dataIndex: 'example',
        key: 'example',
        width: 80,
        render(_value: unknown, item: ParamRow) {
          return <p style={{ whiteSpace: 'pre-wrap' }}>{item.example}</p>;
        }
      },
      {
        title: '备注',
        dataIndex: 'value',
        key: 'value',
        render(_value: unknown, item: ParamRow) {
          return <p style={{ whiteSpace: 'pre-wrap' }}>{item.value}</p>;
        }
      }
    ];

    const dataSource: ParamRow[] = [];
    if (query && query.length) {
      query.map((item: ParamItem, i: number) => {
        dataSource.push({
          key: i,
          name: item.name,
          value: item.desc,
          example: item.example,
          required: item.required == 0 ? '否' : '是'
        });
      });
    }

    return (
      <Table bordered size="small" pagination={false} columns={columns} dataSource={dataSource} />
    );
  }

  countEnter(str?: string) {
    let i = 0;
    let c = 0;
    if (!str || !str.indexOf) {
      return 0;
    }
    while (str.indexOf('\n', i) > -1) {
      i = str.indexOf('\n', i) + 2;
      c++;
    }
    return c;
  }

  componentDidMount() {
    if (!this.props.curData.title && this.state.init) {
      this.setState({ init: false });
    }
  }

  enterItem = () => {
    this.setState({
      enter: true
    });
  };

  leaveItem = () => {
    this.setState({
      enter: false
    });
  };

  copyUrl = (url: string) => {
    copy(url);
    message.success('已经成功复制到剪切板');
  };

  flagMsg = (mock?: boolean, strice?: boolean) => {
    if (mock && strice) {
      return <span>( 全局mock & 严格模式 )</span>;
    } else if (!mock && strice) {
      return <span>( 严格模式 )</span>;
    } else if (mock && !strice) {
      return <span>( 全局mock )</span>;
    } else {
      return;
    }
  };

  render() {
    const dataSource: ParamRow[] = [];
    if (this.props.curData.req_headers && this.props.curData.req_headers.length) {
      this.props.curData.req_headers.map((item: ParamItem, i: number) => {
        dataSource.push({
          key: i,
          name: item.name,
          required: item.required == 0 ? '否' : '是',
          value: item.value,
          example: item.example,
          desc: item.desc
        });
      });
    }

    const req_dataSource: ParamRow[] = [];
    if (this.props.curData.req_params && this.props.curData.req_params.length) {
      this.props.curData.req_params.map((item: ParamItem, i: number) => {
        req_dataSource.push({
          key: i,
          name: item.name,
          desc: item.desc,
          example: item.example
        });
      });
    }
    const req_params_columns: ColumnsType<ParamRow> = [
      {
        title: '参数名称',
        dataIndex: 'name',
        key: 'name',
        width: 140
      },
      {
        title: '示例',
        dataIndex: 'example',
        key: 'example',
        width: 80,
        render(_value: unknown, item: ParamRow) {
          return <p style={{ whiteSpace: 'pre-wrap' }}>{item.example}</p>;
        }
      },
      {
        title: '备注',
        dataIndex: 'desc',
        key: 'desc',
        render(_value: unknown, item: ParamRow) {
          return <p style={{ whiteSpace: 'pre-wrap' }}>{item.desc}</p>;
        }
      }
    ];

    const columns: ColumnsType<ParamRow> = [
      {
        title: '参数名称',
        dataIndex: 'name',
        key: 'name',
        width: '200px'
      },
      {
        title: '参数值',
        dataIndex: 'value',
        key: 'value',
        width: '300px'
      },
      {
        title: '是否必须',
        dataIndex: 'required',
        key: 'required',
        width: '100px'
      },
      {
        title: '示例',
        dataIndex: 'example',
        key: 'example',
        width: '80px',
        render(_value: unknown, item: ParamRow) {
          return <p style={{ whiteSpace: 'pre-wrap' }}>{item.example}</p>;
        }
      },
      {
        title: '备注',
        dataIndex: 'desc',
        key: 'desc',
        render(_value: unknown, item: ParamRow) {
          return <p style={{ whiteSpace: 'pre-wrap' }}>{item.desc}</p>;
        }
      }
    ];
    let status = {
      undone: '未完成',
      done: '已完成'
    };

    let bodyShow =
      this.props.curData.req_body_other ||
      (this.props.curData.req_body_type === 'form' &&
        this.props.curData.req_body_form &&
        this.props.curData.req_body_form.length);

    let requestShow =
      (dataSource && dataSource.length) ||
      (req_dataSource && req_dataSource.length) ||
      (this.props.curData.req_query && this.props.curData.req_query.length) ||
      bodyShow;

    const methodKey = (this.props.curData.method ? this.props.curData.method.toLowerCase() : 'get') as keyof typeof variable.METHOD_COLOR;
    let methodColor = variable.METHOD_COLOR[methodKey] || variable.METHOD_COLOR.get;

    // statusColor = statusColor[this.props.curData.status?this.props.curData.status.toLowerCase():"undone"];
    // const aceEditor = <div style={{ display: this.props.curData.req_body_other && (this.props.curData.req_body_type !== "form") ? "block" : "none" }} className="colBody">
    //   <AceEditor data={this.props.curData.req_body_other} readOnly={true} style={{ minHeight: 300 }} mode={this.props.curData.req_body_type === 'json' ? 'javascript' : 'text'} />
    // </div>
    const { tag, up_time, title, uid, username } = this.props.curData;
    const tags = safeArray<string>(tag);

    let res = (
      <div className="caseContainer">
        <h2 className="interface-title" style={{ marginTop: 0 }}>
          基本信息
        </h2>
        <div className="panel-view">
          <Row className="row">
            <Col span={4} className="colKey">
              接口名称：
            </Col>
            <Col span={8} className="colName">
              <span title={title}>{title}</span>
            </Col>
            <Col span={4} className="colKey">
              创&ensp;建&ensp;人：
            </Col>
            <Col span={8} className="colValue">
              <Link className="user-name" to={'/user/profile/' + uid}>
                <img src={buildApiUrl('/api/user/avatar?uid=' + uid)} className="user-img" />
                {username}
              </Link>
            </Col>
          </Row>
          <Row className="row">
            <Col span={4} className="colKey">
              状&emsp;&emsp;态：
            </Col>
            <Col span={8} className={'tag-status ' + this.props.curData.status}>
              {status[this.props.curData.status]}
            </Col>
            <Col span={4} className="colKey">
              更新时间：
            </Col>
            <Col span={8}>{formatTime(up_time || 0)}</Col>
          </Row>
          {tags.length > 0 && (
              <Row className="row remark">
                <Col span={4} className="colKey">
                  Tag ：
                </Col>
                <Col span={18} className="colValue">
                  {tags.join(' , ')}
                </Col>
              </Row>
            )}
          <Row className="row">
            <Col span={4} className="colKey">
              接口路径：
            </Col>
            <Col
              span={18}
              className="colValue"
              onMouseEnter={this.enterItem}
              onMouseLeave={this.leaveItem}
            >
              <span
                style={{ color: methodColor.color, backgroundColor: methodColor.bac }}
                className="colValue tag-method"
              >
                {this.props.curData.method}
              </span>
              <span className="colValue">
                {this.props.currProject.basepath}
                {this.props.curData.path}
              </span>
              <Tooltip title="复制路径">
                <Icon
                  type="copy"
                  className="interface-url-icon"
                  onClick={() => this.copyUrl(this.props.currProject.basepath + this.props.curData.path)}
                  style={{ display: this.state.enter ? 'inline-block' : 'none' }}
                />
              </Tooltip>
            </Col>
          </Row>
          <Row className="row">
            <Col span={4} className="colKey">
              Mock地址：
            </Col>
            <Col span={18} className="colValue">
              {this.flagMsg(this.props.currProject.is_mock_open, this.props.currProject.strice)}
              {(() => {
                const url = buildMockUrl(
                  this.props.currProject._id,
                  this.props.currProject.basepath,
                  this.props.curData.path
                );
                return (
                  <span className="href" onClick={() => window.open(url, '_blank')}>
                    {url}
                  </span>
                );
              })()}
            </Col>
          </Row>
          {this.props.curData.custom_field_value &&
            this.props.custom_field.enable && (
              <Row className="row remark">
                <Col span={4} className="colKey">
                  {this.props.custom_field.name}：
                </Col>
                <Col span={18} className="colValue">
                  {this.props.curData.custom_field_value}
                </Col>
              </Row>
            )}
        </div>
        {this.props.curData.desc && <h2 className="interface-title">备注</h2>}
        {this.props.curData.desc && (
          <div
            className="toastui-editor-contents tui-editor-contents"
            style={{ margin: '0px', padding: '0px 20px', float: 'none' }}
            dangerouslySetInnerHTML={{ __html: sanitizeHTML(this.props.curData.desc) }}
          />
        )}
        <h2 className="interface-title" style={{ display: requestShow ? '' : 'none' }}>
          请求参数
        </h2>
        {req_dataSource.length ? (
          <div className="colHeader">
            <h3 className="col-title">路径参数：</h3>
            <Table
              bordered
              size="small"
              pagination={false}
              columns={req_params_columns}
              dataSource={req_dataSource}
            />
          </div>
        ) : (
          ''
        )}
        {dataSource.length ? (
          <div className="colHeader">
            <h3 className="col-title">Headers：</h3>
            <Table
              bordered
              size="small"
              pagination={false}
              columns={columns}
              dataSource={dataSource}
            />
          </div>
        ) : (
          ''
        )}
        {this.props.curData.req_query && this.props.curData.req_query.length ? (
          <div className="colQuery">
            <h3 className="col-title">Query：</h3>
            {this.req_query(this.props.curData.req_query)}
          </div>
        ) : (
          ''
        )}

        <div
          style={{
            display:
              this.props.curData.method &&
              HTTP_METHOD[this.props.curData.method.toUpperCase() as keyof typeof HTTP_METHOD].request_body
                ? ''
                : 'none'
          }}
        >
          <h3 style={{ display: bodyShow ? '' : 'none' }} className="col-title">
            Body:
          </h3>
          {this.props.curData.req_body_type === 'form'
            ? this.req_body_form(this.props.curData.req_body_type, this.props.curData.req_body_form)
            : this.req_body(
                this.props.curData.req_body_type,
                this.props.curData.req_body_other,
                this.props.curData.req_body_is_json_schema
              )}
        </div>

        <h2 className="interface-title">返回数据</h2>
        {this.res_body(
          this.props.curData.res_body_type,
          this.props.curData.res_body,
          this.props.curData.res_body_is_json_schema
        )}
      </div>
    );

    if (!this.props.curData.title) {
      if (this.state.init) {
        res = <div />;
      } else {
        res = <ErrMsg type="noData" />;
      }
    }
    return res;
  }
}

export default View as unknown as ComponentType<Pick<ViewProps, 'switchToView'>>;
