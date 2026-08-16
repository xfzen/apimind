import React, { PureComponent as Component } from 'react';
import type { ComponentType } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { Button, Input, message } from 'antd';
import Icon from 'client/shims/antdIcon';
import {
  fetchTemplates,
  getTemplate,
  updateTemplate,
  searchTemplates
} from '../../../reducer/modules/template';
import TemplateNav from './TemplateNav';
import TemplateDocument from './TemplateDocument';
import TemplateEditor from './TemplateEditor';
import './TemplateProject.scss';
import type { ApiResponse } from '../../../types/api';
import type { RootState } from '../../../reducer/modules/reducer';
import type { TemplateItem } from '../../../reducer/modules/template';
import type { UnknownRecord } from '../../../reducer/types/runtime';
import type { TemplateEditorSaveValue } from './TemplateEditor';
import { asLegacyClassDecorator } from '../../../types/legacyDecorators';

type TemplateResult<T> = Promise<{ payload: { data: ApiResponse<T> } }>;
interface TemplateProjectProps {
  project?: UnknownRecord & { name?: string };
  templates: TemplateItem[];
  current: TemplateItem | null;
  fetchTemplates: (params?: UnknownRecord) => TemplateResult<TemplateItem[]>;
  getTemplate: (key: string) => TemplateResult<TemplateItem>;
  updateTemplate: (data: TemplateItem) => TemplateResult<TemplateItem>;
  searchTemplates: (params: UnknownRecord) => TemplateResult<TemplateItem[]>;
}
interface TemplateProjectState { selectedKey: string; editing: boolean; keyword: string }
const connectTemplateProject = asLegacyClassDecorator(connect(
  (state: RootState) => ({
    templates: state.template.list,
    current: state.template.current
  }),
  {
    fetchTemplates,
    getTemplate,
    updateTemplate,
    searchTemplates
  }
));
@connectTemplateProject
class TemplateProject extends Component<TemplateProjectProps, TemplateProjectState> {
  static propTypes = {
    project: PropTypes.object,
    templates: PropTypes.array,
    current: PropTypes.object,
    fetchTemplates: PropTypes.func,
    getTemplate: PropTypes.func,
    updateTemplate: PropTypes.func,
    searchTemplates: PropTypes.func
  };

  constructor(props: TemplateProjectProps) {
    super(props);
    this.state = {
      selectedKey: '',
      editing: false,
      keyword: ''
    };
  }

  async componentDidMount() {
    await this.loadTemplates();
  }

  async loadTemplates() {
    const res = await this.props.fetchTemplates();
    const list = res.payload.data.data || [];
    if (list.length > 0) {
      await this.selectTemplate(list[0].key);
    }
  }

  selectTemplate = async (key: string) => {
    if (!key) return;
    this.setState({ selectedKey: key, editing: false });
    await this.props.getTemplate(key);
  };

  search = async (value: string) => {
    this.setState({ keyword: value });
    const action = value ? this.props.searchTemplates({ keyword: value }) : this.props.fetchTemplates();
    const res = await action;
    const list = res.payload.data.data || [];
    if (list.length > 0) {
      await this.selectTemplate(list[0].key);
    }
  };

  saveTemplate = async (data: TemplateEditorSaveValue) => {
    const res = await this.props.updateTemplate(data as unknown as TemplateItem);
    const payload = res.payload.data;
    if (payload.errcode !== 0) {
      message.error(payload.errmsg || '保存失败');
      return;
    }
    message.success('保存成功');
    this.setState({ editing: false });
  };

  render() {
    const { project, templates, current } = this.props;
    const title = project && project.name ? project.name : '模板项目';
    return (
      <div className="template-project">
        <aside className="template-project__nav">
          <div className="template-project__nav-head">
            <span>{title}</span>
          </div>
          <Input.Search
            className="template-project__search"
            placeholder="搜索模板"
            onSearch={this.search}
            allowClear
          />
          <TemplateNav
            list={templates || []}
            selectedKey={this.state.selectedKey}
            onSelect={this.selectTemplate}
          />
        </aside>
        <main className="template-project__content">
          {current ? (
            this.state.editing ? (
              <TemplateEditor
                template={current}
                onCancel={() => this.setState({ editing: false })}
                onSave={this.saveTemplate}
              />
            ) : (
              <TemplateDocument
                template={current}
                action={
                  <Button type="primary" onClick={() => this.setState({ editing: true })}>
                    <Icon type="edit" /> 编辑
                  </Button>
                }
              />
            )
          ) : (
            <div className="template-project__empty">暂无模板</div>
          )}
        </main>
      </div>
    );
  }
}

export default TemplateProject as unknown as ComponentType<Pick<TemplateProjectProps, 'project'>>;
