import React, { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { Tree } from 'antd';
import Icon from 'client/shims/antdIcon';

function groupedTemplates(list) {
  return (list || []).reduce((acc, item) => {
    const name = item.category || '未分类';
    if (!acc[name]) acc[name] = [];
    acc[name].push(item);
    return acc;
  }, {});
}

export default function TemplateNav(props) {
  const groups = useMemo(() => groupedTemplates(props.list), [props.list]);
  const categoryKeys = useMemo(() => Object.keys(groups).map(category => `cat_${category}`), [groups]);
  const [expandedKeys, setExpandedKeys] = useState(categoryKeys);

  useEffect(() => {
    setExpandedKeys(categoryKeys);
  }, [categoryKeys]);

  const treeData = Object.keys(groups).map(category => ({
    key: `cat_${category}`,
    className: 'template-nav__category-node',
    title: (
      <span className="template-nav__category-title">
        <Icon type="folder-open" style={{ marginRight: 5 }} />
        {category}
      </span>
    ),
    children: groups[category].map(item => ({
      key: item.key,
      className: 'template-nav__item-node',
      title: (
        <span className="template-nav__item-title">
          <Icon type="file-text" style={{ marginRight: 5 }} />
          {item.title}
        </span>
      )
    }))
  }));

  return (
    <div className="template-nav">
      <Tree
        className="template-nav__tree"
        expandedKeys={expandedKeys}
        selectedKeys={props.selectedKey ? [props.selectedKey] : []}
        onExpand={keys => setExpandedKeys(keys)}
        onSelect={(keys, event) => {
          if (!event.node.children && keys[0]) {
            props.onSelect(keys[0]);
          }
        }}
        treeData={treeData}
      />
    </div>
  );
}

TemplateNav.propTypes = {
  list: PropTypes.array,
  selectedKey: PropTypes.string,
  onSelect: PropTypes.func
};
