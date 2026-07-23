import React from 'react';
import PropTypes from 'prop-types';
import MarkdownIt from 'markdown-it';

const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true
});

export default function TemplateDocument(props) {
  const template = props.template || {};
  return (
    <div className="template-document">
      <div className="template-document__header">
        <div>
          <h2>{template.title}</h2>
          <div className="template-document__meta">
            {template.category} / {template.key}
          </div>
        </div>
        <div>{props.action}</div>
      </div>
      <div
        className="template-document__body"
        dangerouslySetInnerHTML={{ __html: md.render(template.markdown || '') }}
      />
    </div>
  );
}

TemplateDocument.propTypes = {
  template: PropTypes.object,
  action: PropTypes.node
};
