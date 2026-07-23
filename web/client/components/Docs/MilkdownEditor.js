import React, { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { Crepe } from '@milkdown/crepe';
import '@milkdown/crepe/theme/common/style.css';
import '@milkdown/crepe/theme/frame.css';

export default function MilkdownEditor({ value, onChange }) {
  const rootRef = useRef(null);
  const editorRef = useRef(null);

  useEffect(() => {
    if (!rootRef.current) return undefined;
    const crepe = new Crepe({
      root: rootRef.current,
      defaultValue: value || ''
    });
    crepe.create().then(() => {
      editorRef.current = crepe;
    });
    return () => {
      editorRef.current = null;
      crepe.destroy();
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (editorRef.current && typeof editorRef.current.getMarkdown === 'function') {
        onChange(editorRef.current.getMarkdown());
      }
    }, 500);
    return () => window.clearInterval(timer);
  }, [onChange]);

  return <div className="apimind-milkdown-editor" ref={rootRef} />;
}

MilkdownEditor.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func
};
