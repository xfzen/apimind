import React, { PureComponent as Component } from 'react';
import type { ComponentType } from 'react';
import { Tabs } from 'antd';
import PropTypes from 'prop-types';
import ProjectMessage from './ProjectMessage/ProjectMessage';
import ProjectEnv from './ProjectEnv';
import ProjectRequest from './ProjectRequest/ProjectRequest';
import ProjectToken from './ProjectToken/ProjectToken';
import ProjectMock from './ProjectMock';
import { builtinSettingTabs } from './settingTabs';
import { connect } from 'react-redux';
import type { RouteComponentProps } from 'react-router';
import type { RootState } from '../../../reducer/modules/reducer';
import { asLegacyClassDecorator } from '../../../types/legacyDecorators';
const TabPane = Tabs.TabPane;

import './Setting.scss';

interface SettingProps extends RouteComponentProps<{ id: string }> { curProjectRole?: string }
const connectSetting = asLegacyClassDecorator(connect((state: RootState) => {
  return {
    curProjectRole: state.project.currProject.role
  };
}));
@connectSetting
class Setting extends Component<SettingProps> {
  static propTypes = {
    match: PropTypes.object,
    curProjectRole: PropTypes.string
  };

  render() {
    const id = this.props.match.params.id;
    return (
      <div className="g-row">
        <Tabs type="card" className="has-affix-footer tabs-large">
          <TabPane tab="项目配置" key="1">
            <ProjectMessage projectId={+id} />
          </TabPane>
          <TabPane tab="环境配置" key="2">
            <ProjectEnv projectId={+id} />
          </TabPane>
          <TabPane tab="请求配置" key="3">
            <ProjectRequest projectId={+id} />
          </TabPane>
          {this.props.curProjectRole !== 'guest' ? (
            <TabPane tab="token配置" key="4">
              <ProjectToken projectId={+id} curProjectRole={this.props.curProjectRole} />
            </TabPane>
          ) : null}
          <TabPane tab="全局mock脚本" key="5">
            <ProjectMock projectId={+id} />
          </TabPane>
          {builtinSettingTabs.map(tab => {
            const C = tab.component;
            return (
              <TabPane tab={tab.name} key={tab.key}>
                <C projectId={+id} />
              </TabPane>
            );
          })}
        </Tabs>
      </div>
    );
  }
}

export default Setting as unknown as ComponentType<RouteComponentProps<{ id: string }>>;
