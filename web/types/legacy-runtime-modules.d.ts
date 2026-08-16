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
