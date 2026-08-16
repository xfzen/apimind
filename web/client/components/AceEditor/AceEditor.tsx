import React from 'react';
import mockEditor, { type MockEditorInstance } from './mockEditor';
import type * as Ace from 'brace';
import type { CSSProperties } from 'react';
import PropTypes from 'prop-types';
import './AceEditor.scss';

const ModeMap = {
  javascript: 'ace/mode/javascript',
  json: 'ace/mode/json',
  text: 'ace/mode/text',
  xml: 'ace/mode/xml',
  html: 'ace/mode/html'
};

const defaultStyle = { width: '100%', height: '200px' };

function getMode(mode: string): string {
  return ModeMap[mode as keyof typeof ModeMap] || ModeMap.text;
}

type MockEditorOptions = NonNullable<Parameters<typeof mockEditor>[0]>;

interface AceEditorProps {
  data?: unknown;
  onChange?: MockEditorOptions['onChange'];
  className?: string;
  mode?: string;
  readOnly?: boolean;
  callback?: (editor: Ace.Editor) => void;
  style?: CSSProperties;
  fullScreen?: boolean;
  insertCode?: (code: string) => void;
}

class AceEditor extends React.PureComponent<AceEditorProps> {
  editor?: MockEditorInstance;
  editorElement: HTMLDivElement | null = null;

  constructor(props: AceEditorProps) {
    super(props);
  }

  static propTypes = {
    data: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.number,
      PropTypes.bool,
      PropTypes.object,
      PropTypes.array
    ]),
    onChange: PropTypes.func,
    className: PropTypes.string,
    mode: PropTypes.string, //enum[json, text, javascript], default is javascript
    readOnly: PropTypes.bool,
    callback: PropTypes.func,
    style: PropTypes.object,
    fullScreen: PropTypes.bool,
    insertCode: PropTypes.func
  };

  componentDidMount() {
    this.editor = mockEditor({
      container: this.editorElement as HTMLDivElement,
      data: this.props.data,
      onChange: this.props.onChange,
      readOnly: this.props.readOnly,
      fullScreen: this.props.fullScreen
    });
    let mode = this.props.mode || 'javascript';
    this.editor.editor.getSession().setMode(getMode(mode));
    if (typeof this.props.callback === 'function') {
      this.props.callback(this.editor.editor);
    }
  }

  componentWillReceiveProps(nextProps: AceEditorProps) {
    if (!this.editor) {
      return;
    }
    if (nextProps.data !== this.props.data && this.editor.getValue() !== nextProps.data) {
      this.editor.setValue(nextProps.data);
      let mode = nextProps.mode || 'javascript';
      this.editor.editor.getSession().setMode(getMode(mode));
      this.editor.editor.clearSelection();
    }
  }

  render() {
    return (
      <div
        className={this.props.className}
        style={this.props.className ? undefined : this.props.style || defaultStyle}
        ref={editor => {
          this.editorElement = editor;
        }}
      />
    );
  }
}

export default AceEditor;
