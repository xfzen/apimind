import type { CSSProperties, ForwardRefExoticComponent, RefAttributes } from 'react';

export interface LegacyIconProps {
  type: string;
  style?: CSSProperties;
}

declare const LegacyIcon: ForwardRefExoticComponent<
  LegacyIconProps & RefAttributes<HTMLElement>
>;

export default LegacyIcon;
