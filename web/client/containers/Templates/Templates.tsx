import React, { PureComponent as Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { Link } from 'react-router-dom';
import { Button, Empty, List } from 'antd';
import Icon from 'client/shims/antdIcon';
import { fetchTemplateProjects } from '../../reducer/modules/template';
import { setBreadcrumb } from '../../reducer/modules/user';
import type { RootState } from '../../reducer/modules/reducer';
import type { BreadcrumbItem } from '../../types/user';
import { asLegacyClassDecorator } from '../../types/legacyDecorators';
import './Templates.scss';

interface TemplateProject {
  id: string | number;
  name: string;
  workspace: string;
  kind: string;
}
interface TemplatesProps {
  projects: TemplateProject[];
  fetchTemplateProjects: () => unknown;
  setBreadcrumb: (data: BreadcrumbItem[]) => unknown;
}
const connectTemplates = asLegacyClassDecorator(connect(
  (state: RootState) => ({
    projects: state.template.projects
  }),
  {
    fetchTemplateProjects,
    setBreadcrumb
  }
));
@connectTemplates
export default class Templates extends Component<TemplatesProps> {
  static propTypes = {
    projects: PropTypes.array,
    fetchTemplateProjects: PropTypes.func,
    setBreadcrumb: PropTypes.func
  };

  componentDidMount() {
    this.props.setBreadcrumb([{ name: '模板' }]);
    this.props.fetchTemplateProjects();
  }

  render() {
    const projects = this.props.projects || [];
    return (
      <div className="template-home">
        <div className="template-home__header">
          <h2>模板</h2>
        </div>
        {projects.length === 0 ? (
          <Empty description="暂无模板项目" />
        ) : (
          <List
            dataSource={projects}
            renderItem={item => (
              <List.Item
                actions={[
                  <Link key="open" to={`/project/${item.id}`}>
                    <Button type="primary">
                      <Icon type="folder-open" /> 打开
                    </Button>
                  </Link>
                ]}
              >
                <List.Item.Meta
                  title={<Link to={`/project/${item.id}`}>{item.name}</Link>}
                  description={`${item.workspace} / ${item.kind}`}
                />
              </List.Item>
            )}
          />
        )}
      </div>
    );
  }
}
