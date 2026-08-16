import React, { PureComponent as Component } from 'react';
import PropTypes from 'prop-types';
import { Button, Input } from 'antd';
import Icon from 'client/shims/antdIcon';
import Editor from 'client/shims/tui-editor';

export default class TemplateEditor extends Component {
  static propTypes = {
    template: PropTypes.object,
    onCancel: PropTypes.func,
    onSave: PropTypes.func
  };

  constructor(props) {
    super(props);
    const template = props.template || {};
    this.state = {
      title: template.title || '',
      description: template.description || '',
      changeReason: 'manual template update',
      changeSummary: 'update template markdown'
    };
  }

  componentDidMount() {
    this.editor = new Editor({
      el: this.editorEl,
      height: '560px',
      initialEditType: 'markdown',
      previewStyle: 'vertical',
      initialValue: (this.props.template && this.props.template.markdown) || ''
    });
  }

  componentWillUnmount() {
    if (this.editor && this.editor.destroy) {
      this.editor.destroy();
    }
    this.editor = null;
  }

  save = () => {
    const template = this.props.template || {};
    this.props.onSave({
      key: template.key,
      title: this.state.title,
      description: this.state.description,
      markdown: this.editor ? this.editor.getMarkdown() : template.markdown || '',
      change_reason: this.state.changeReason,
      change_summary: this.state.changeSummary
    });
  };

  render() {
    return (
      <div className="template-editor">
        <div className="template-editor__bar">
          <Input
            value={this.state.title}
            onChange={e => this.setState({ title: e.target.value })}
            placeholder="标题"
          />
          <div className="template-editor__actions">
            <Button onClick={this.props.onCancel}>取消</Button>
            <Button type="primary" onClick={this.save}>
              <Icon type="save" /> 保存
            </Button>
          </div>
        </div>
        <Input
          className="template-editor__desc"
          value={this.state.description}
          onChange={e => this.setState({ description: e.target.value })}
          placeholder="描述"
        />
        <div className="template-editor__meta">
          <Input
            value={this.state.changeReason}
            onChange={e => this.setState({ changeReason: e.target.value })}
            placeholder="变更原因"
          />
          <Input
            value={this.state.changeSummary}
            onChange={e => this.setState({ changeSummary: e.target.value })}
            placeholder="变更摘要"
          />
        </div>
        <div className="template-editor__markdown" ref={el => (this.editorEl = el)} />
      </div>
    );
  }
}
