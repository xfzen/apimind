import React from 'react';
import { Collapse as AntCollapse } from 'antd';
import type { CollapseProps } from 'antd';
import type { ReactElement, ReactNode } from 'react';

interface LegacyPanelProps extends Record<string, unknown> {
  children?: ReactNode;
  header?: ReactNode;
}

interface LegacyCollapseProps extends Omit<CollapseProps, 'items'> {
  children?: ReactNode;
  items?: CollapseProps['items'];
}

type LegacyCollapseComponent = ((props: LegacyCollapseProps) => ReactElement) & {
  Panel: typeof AntCollapse.Panel;
};

const LegacyCollapse = (({ children, items, ...props }: LegacyCollapseProps) => {
  if (items || !children) {
    return <AntCollapse {...props} items={items} />;
  }

  const nextItems: NonNullable<CollapseProps['items']> = [];
  React.Children.forEach(children, (child, index) => {
    if (!React.isValidElement<LegacyPanelProps>(child)) {
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
}) as LegacyCollapseComponent;

LegacyCollapse.Panel = AntCollapse.Panel;

export default LegacyCollapse;
