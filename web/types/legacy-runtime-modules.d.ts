declare module '*moment/dist/moment.js' {
  import moment from 'moment';
  export default moment;
}

declare module '*react-is.production.min.js' {
  import * as ReactIs from 'react-is';
  export default ReactIs;
}

declare module '@toast-ui/editor' {
  import Editor from '../node_modules/@toast-ui/editor/types/index';
  export default Editor;
}

declare module 'rc-scroll-anim' {
  import type { ComponentType, ReactNode } from 'react';

  interface ScrollAnimationProps {
    children?: ReactNode;
    [key: string]: unknown;
  }

  export const OverPack: ComponentType<ScrollAnimationProps>;
}

declare module 'rc-tween-one' {
  import type { ComponentType, ReactNode } from 'react';

  interface TweenProps {
    children?: ReactNode;
    [key: string]: unknown;
  }

  const TweenOne: ComponentType<TweenProps>;
  export default TweenOne;
}
