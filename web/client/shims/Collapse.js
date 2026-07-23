import React from 'react';
import { Collapse as AntCollapse } from 'antd';

function LegacyCollapse({ children, items, ...props }) {
  if (items || !children) {
    return <AntCollapse {...props} items={items} />;
  }

  const nextItems = [];
  React.Children.forEach(children, (child, index) => {
    if (!React.isValidElement(child)) {
      return;
    }

    const { children: panelChildren, header, ...panelProps } = child.props;
    nextItems.push({
      ...panelProps,
      key: child.key == null ? String(index) : child.key,
      label: header,
      children: panelChildren
    });
  });

  return <AntCollapse {...props} items={nextItems} />;
}

LegacyCollapse.Panel = AntCollapse.Panel;

export default LegacyCollapse;
