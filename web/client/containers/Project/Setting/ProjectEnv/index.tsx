import React, { Component } from 'react';
import type { ComponentType, MouseEvent } from 'react';
import PropTypes from 'prop-types';
import './index.scss';
import { Layout, Tooltip, message, Row, Popconfirm } from 'antd';
import Icon from 'client/shims/antdIcon';
const { Content, Sider } = Layout;
import ProjectEnvContent from './ProjectEnvContent';
import type { ProjectEnvironment } from './ProjectEnvContent';
import { connect } from 'react-redux';
import { updateEnv, getProject, getEnv } from '../../../../reducer/modules/project';
import EasyDragSort from '../../../../components/EasyDragSort/EasyDragSort';
import type { ApiResponse } from '../../../../types/api';
import type { RootState } from '../../../../reducer/modules/reducer';
import type { UnknownRecord } from '../../../../reducer/types/runtime';
import { asLegacyClassDecorator } from '../../../../types/legacyDecorators';

interface ProjectWithEnvironment extends UnknownRecord {
  _id: string | number;
  env: ProjectEnvironment[];
}
interface EnvironmentAssignment {
  _id: string | number | null;
  env: ProjectEnvironment[];
}
type ProjectEnvResponse = { payload: { data: ApiResponse<unknown> } };
interface ProjectEnvProps {
  projectId: number;
  updateEnv: (value: EnvironmentAssignment) => Promise<ProjectEnvResponse>;
  getProject: (id: number) => Promise<unknown>;
  projectMsg: ProjectWithEnvironment;
  onOk?: (env: ProjectEnvironment[], index: number) => void;
  getEnv: (id: number) => unknown;
}
interface ProjectEnvState {
  env: ProjectEnvironment[];
  _id: string | number | null;
  currentEnvMsg: ProjectEnvironment;
  delIcon: number | null;
  currentKey: number;
}
const emptyEnvironment = (): ProjectEnvironment => ({
  name: '新环境', domain: '', header: [], global: []
});
const connectProjectEnv = asLegacyClassDecorator(connect(
  (state: RootState) => {
    return {
      projectMsg: state.project.currProject
    };
  },
  {
    updateEnv,
    getProject,
    getEnv
  }
));
@connectProjectEnv
class ProjectEnv extends Component<ProjectEnvProps, ProjectEnvState> {
  static propTypes = {
    projectId: PropTypes.number,
    updateEnv: PropTypes.func,
    getProject: PropTypes.func,
    projectMsg: PropTypes.object,
    onOk: PropTypes.func,
    getEnv: PropTypes.func
  };

  _isMounted = false;

  constructor(props: ProjectEnvProps) {
    super(props);
    this.state = {
      env: [],
      _id: null,
      currentEnvMsg: emptyEnvironment(),
      delIcon: null,
      currentKey: -2
    };
  }

  initState(curdata: ProjectEnvironment[], id: string | number) {
    this.setState({ env: curdata.concat(), _id: id });
  }

  async componentWillMount() {
    this._isMounted = true;
    await this.props.getProject(this.props.projectId);
    const { env, _id } = this.props.projectMsg;
    this.initState(env, _id);
    this.handleClick(0, env[0] || emptyEnvironment());
  }

  componentWillUnmount() {
    this._isMounted = false;
  }

  handleClick = (key: number, data: ProjectEnvironment) => {
    this.setState({
      currentEnvMsg: data,
      currentKey: key
    });
  };

  // 增加环境变量项
  addParams = (_name: 'env') => {
    const data = emptyEnvironment();
    this.setState({ env: [data].concat(this.state.env) });
    this.handleClick(0, data);
  };

  // 删除提示信息
  showConfirm(key: number, name: 'env') {
    let assignValue = this.delParams(key, name);
    this.onSave(assignValue);
  }

  // 删除环境变量项
  delParams = (key: number, _name: 'env'): EnvironmentAssignment => {
    const env = this.state.env.filter((_val, index) => {
      return index !== key;
    });
    this.setState({ env });
    this.handleClick(0, env[0] || emptyEnvironment());
    return { env, _id: this.state._id };
  };

  enterItem = (key: number) => {
    this.setState({ delIcon: key });
  };

  // 保存设置
  async onSave(assignValue: EnvironmentAssignment) {
    await this.props
      .updateEnv(assignValue)
      .then(res => {
        if (res.payload.data.errcode == 0) {
          this.props.getProject(this.props.projectId);
          this.props.getEnv(this.props.projectId);
          message.success('修改成功! ');
          if(this._isMounted) {
            this.setState({ ...assignValue });
          }
        }
      })
      .catch(() => {
        message.error('环境设置不成功 ');
      });
  }

  //  提交保存信息
  onSubmit = (value: { env: ProjectEnvironment }, index: number) => {
    const assignValue: EnvironmentAssignment = {
      env: this.state.env.concat(),
      _id: this.state._id
    };
    assignValue.env.splice(index, 1, value.env);
    this.onSave(assignValue);
    this.props.onOk && this.props.onOk(assignValue.env, index);
  };

  // 动态修改环境名称
  handleInputChange = (value: string, currentKey: number) => {
    const newValue = this.state.env.concat();
    newValue[currentKey].name = value || '新环境';
    this.setState({ env: newValue });
  };

  // 侧边栏拖拽
  handleDragMove = (_name: 'env') => {
    return (data: unknown[], _from: number | null, to: number) => {
      const env = data as ProjectEnvironment[];
      const newValue: EnvironmentAssignment = { env, _id: this.state._id };
      this.setState({ env });
      this.handleClick(to, env[to]);
      this.onSave(newValue);
    };
  };

  render() {
    const { env, currentKey } = this.state;

    const envSettingItems = env.map((item, index) => {
      return (
        <Row
          key={index}
          className={'menu-item ' + (index === currentKey ? 'menu-item-checked' : '')}
          onClick={() => this.handleClick(index, item)}
          onMouseEnter={() => this.enterItem(index)}
        >
          <span className="env-icon-style">
            <span className="env-name" style={{ color: item.name === '新环境' ? '#2395f1' : undefined }}>
              {item.name}
            </span>
            <Popconfirm
              title="您确认删除此环境变量?"
              onConfirm={(e?: MouseEvent<HTMLElement>) => {
                e?.stopPropagation();
                this.showConfirm(index, 'env');
              }}
              okText="确定"
              cancelText="取消"
            >
              <Icon
                type="delete"
                className="interface-delete-icon"
                style={{
                  display: this.state.delIcon == index && env.length - 1 !== 0 ? 'block' : 'none'
                }}
              />
            </Popconfirm>
          </span>
        </Row>
      );
    });

    return (
      <div className="m-env-panel">
        <Layout className="project-env">
          <Sider width={195} style={{ background: '#fff' }}>
            <div style={{ height: '100%', borderRight: 0 }}>
              <Row className="first-menu-item menu-item">
                <div className="env-icon-style">
                  <h3>
                    环境列表&nbsp;<Tooltip placement="top" title="在这里添加项目的环境配置">
                      <Icon type="question-circle-o" />
                    </Tooltip>
                  </h3>
                  <Tooltip title="添加环境变量">
                    <Icon type="plus" onClick={() => this.addParams('env')} />
                  </Tooltip>
                </div>
              </Row>
              <EasyDragSort data={() => env} onChange={this.handleDragMove('env')}>
                {envSettingItems}
              </EasyDragSort>
            </div>
          </Sider>
          <Layout className="env-content">
            <Content style={{ background: '#fff', padding: 24, margin: 0, minHeight: 280 }}>
              <ProjectEnvContent
                projectMsg={this.state.currentEnvMsg}
                onSubmit={e => this.onSubmit(e, currentKey)}
                handleEnvInput={e => this.handleInputChange(e, currentKey)}
              />
            </Content>
          </Layout>
        </Layout>
      </div>
    );
  }
}

export default ProjectEnv as unknown as ComponentType<Pick<ProjectEnvProps, 'projectId' | 'onOk'>>;
