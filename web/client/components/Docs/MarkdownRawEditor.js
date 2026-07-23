import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import PropTypes from 'prop-types';
import { Compartment, EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import { defaultHighlightStyle, syntaxHighlighting } from '@codemirror/language';

const MarkdownRawEditor = forwardRef(function MarkdownRawEditor(props, ref) {
  const { value, onChange, onActiveLineChange, readOnly } = props;
  const rootRef = useRef(null);
  const viewRef = useRef(null);
  const valueRef = useRef(value || '');
  const onChangeRef = useRef(onChange);
  const onActiveLineChangeRef = useRef(onActiveLineChange);
  const activeLineRef = useRef(0);
  const activeLineFrameRef = useRef(0);
  const suppressChangeRef = useRef(false);
  const editableCompartmentRef = useRef(new Compartment());

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    onActiveLineChangeRef.current = onActiveLineChange;
  }, [onActiveLineChange]);

  useImperativeHandle(ref, () => ({
    getScrollElement() {
      return viewRef.current ? viewRef.current.scrollDOM : null;
    },
    scrollToRatio(ratio) {
      const view = viewRef.current;
      if (!view) return;
      const scrollEl = view.scrollDOM;
      const maxScrollTop = Math.max(0, scrollEl.scrollHeight - scrollEl.clientHeight);
      scrollEl.scrollTop = maxScrollTop * Math.max(0, Math.min(1, Number(ratio) || 0));
    },
    scrollToLine(lineNumber) {
      const view = viewRef.current;
      if (!view) return;
      const safeLineNumber = Math.max(1, Math.min(Number(lineNumber) || 1, view.state.doc.lines));
      const line = view.state.doc.line(safeLineNumber);
      view.dispatch({
        selection: { anchor: line.from },
        effects: EditorView.scrollIntoView(line.from, { y: 'start' })
      });
      view.focus();
    }
  }), []);

  useEffect(() => {
    if (!rootRef.current) return undefined;

    const emitActiveLine = view => {
      if (!onActiveLineChangeRef.current) return;
      const lineNumber = view.state.doc.lineAt(view.viewport.from).number;
      if (lineNumber === activeLineRef.current) return;
      activeLineRef.current = lineNumber;
      onActiveLineChangeRef.current(lineNumber);
    };

    const scheduleActiveLine = view => {
      if (activeLineFrameRef.current) return;
      activeLineFrameRef.current = window.requestAnimationFrame(() => {
        activeLineFrameRef.current = 0;
        emitActiveLine(view);
      });
    };

    const updateListener = EditorView.updateListener.of(update => {
      if (update.viewportChanged || update.selectionSet) {
        scheduleActiveLine(update.view);
      }
      if (update.docChanged) {
        const nextValue = update.state.doc.toString();
        valueRef.current = nextValue;
        scheduleActiveLine(update.view);
        if (suppressChangeRef.current) return;
        if (onChangeRef.current) onChangeRef.current(nextValue);
      }
    });

    const state = EditorState.create({
      doc: value || '',
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        markdown(),
        syntaxHighlighting(defaultHighlightStyle),
        EditorView.lineWrapping,
        editableCompartmentRef.current.of(EditorView.editable.of(!readOnly)),
        updateListener
      ]
    });

    const view = new EditorView({ state, parent: rootRef.current });
    viewRef.current = view;
    valueRef.current = value || '';
    scheduleActiveLine(view);

    return () => {
      if (activeLineFrameRef.current) {
        window.cancelAnimationFrame(activeLineFrameRef.current);
        activeLineFrameRef.current = 0;
      }
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    const nextValue = value || '';
    if (!view || nextValue === valueRef.current) return;

    suppressChangeRef.current = true;
    try {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: nextValue }
      });
      valueRef.current = nextValue;
    } finally {
      suppressChangeRef.current = false;
    }
  }, [value]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: editableCompartmentRef.current.reconfigure(EditorView.editable.of(!readOnly))
    });
  }, [readOnly]);

  return <div className="apimind-raw-editor" ref={rootRef} />;
});

export default MarkdownRawEditor;

MarkdownRawEditor.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func,
  onActiveLineChange: PropTypes.func,
  readOnly: PropTypes.bool
};
