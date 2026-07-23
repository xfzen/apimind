import React from 'react';
import PropTypes from 'prop-types';
import { Button, Empty, Tooltip } from 'antd';
import Icon from 'client/shims/antdIcon';

function sortDocs(items) {
  return [].concat(items || []).sort((a, b) => {
    if (a.parent_id === b.parent_id) return (a.sort || 0) - (b.sort || 0);
    return (a.parent_id || 0) - (b.parent_id || 0);
  });
}

function buildTree(items) {
  const byParent = {};
  items.forEach(item => {
    const parentId = item.parent_id || 0;
    byParent[parentId] = byParent[parentId] || [];
    byParent[parentId].push(item);
  });
  return byParent;
}

export default function DocTree({ docs, currentId, onSelect, onCreate }) {
  const items = sortDocs(docs);
  const canCreate = typeof onCreate === 'function';
  const byParent = buildTree(items);
  const renderItems = (parentId, level) => (byParent[parentId] || []).map(item => (
    <li key={item.id} className={item.id === currentId ? 'active' : ''}>
      <div className="doc-tree-row" style={{ paddingLeft: level * 16 }}>
        <button type="button" onClick={() => onSelect(item.id)}>
          {item.title}
        </button>
        {canCreate ? (
          <Tooltip title="新建子文档">
            <Button size="small" type="link" icon={<Icon type="plus" />} onClick={() => onCreate(item.id)} />
          </Tooltip>
        ) : null}
      </div>
      {(byParent[item.id] || []).length ? <ul>{renderItems(item.id, level + 1)}</ul> : null}
    </li>
  ));
  return (
    <aside className="apimind-docs-tree">
      {canCreate ? (
        <div className="tree-toolbar">
          <Button type="primary" size="small" icon={<Icon type="plus" />} onClick={() => onCreate(0)}>
            新建文档
          </Button>
        </div>
      ) : null}
      {!items.length ? (
        <Empty description="暂无文档" />
      ) : (
        <ul>{renderItems(0, 0)}</ul>
      )}
    </aside>
  );
}

DocTree.propTypes = {
  docs: PropTypes.array,
  currentId: PropTypes.number,
  onSelect: PropTypes.func,
  onCreate: PropTypes.func
};
