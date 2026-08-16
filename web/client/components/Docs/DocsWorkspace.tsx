import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import PropTypes from 'prop-types';
import { Button, Input, Radio } from 'antd';
import MarkdownPreview from './MarkdownPreview';
import MarkdownRawEditor from './MarkdownRawEditor';
import type { MarkdownRawEditorHandle } from './MarkdownRawEditor';
import { extractHeadings } from './markdownHeadings';
import type { MarkdownHeading } from './markdownHeadings';

type DocsWorkspaceMode = 'viewer' | 'editor' | 'split';

interface DocsWorkspaceProps {
  canEdit?: boolean;
  dirty?: boolean;
  fileName?: string;
  mode?: DocsWorkspaceMode;
  title?: string;
  content?: string;
  onModeChange: (mode: DocsWorkspaceMode) => void;
  onTitleChange: (title: string) => void;
  onContentChange: (content: string) => void;
  onActiveHeadingChange?: (headingId: string) => void;
  onSave?: () => void;
}

export interface DocsWorkspaceHandle {
  jumpToHeading(heading: MarkdownHeading): void;
}

const modes = [
  { label: '预览', value: 'viewer' },
  { label: '编辑', value: 'editor' },
  { label: '分屏', value: 'split' }
];

const DocsWorkspace = forwardRef<DocsWorkspaceHandle, DocsWorkspaceProps>(function DocsWorkspace(props, ref) {
  const {
    canEdit,
    dirty,
    fileName,
    mode,
    title,
    content,
    onModeChange,
    onTitleChange,
    onContentChange,
    onActiveHeadingChange,
    onSave
  } = props;
  const effectiveMode = canEdit ? mode : 'viewer';
  const editorRef = useRef<MarkdownRawEditorHandle>(null);
  const splitEditorRef = useRef<MarkdownRawEditorHandle>(null);
  const viewerPaneRef = useRef<HTMLDivElement>(null);
  const splitViewerRef = useRef<HTMLDivElement>(null);
  const splitSyncLockRef = useRef(false);
  const splitSyncFrameRef = useRef(0);
  const headings = useMemo(() => extractHeadings(content || ''), [content]);

  const jumpEditorToHeading = useCallback((heading: MarkdownHeading, targetRef = editorRef) => {
    if (targetRef.current && heading.line) {
      targetRef.current.scrollToLine(heading.line);
    }
  }, []);

  const jumpPreviewToHeading = useCallback((heading: MarkdownHeading) => {
    if (!heading || !heading.id) return;
    const target = document.getElementById(heading.id);
    if (target) {
      target.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
  }, []);

  useImperativeHandle(ref, () => ({
    jumpToHeading(heading) {
      if (effectiveMode === 'editor') {
        jumpEditorToHeading(heading);
        return;
      }
      if (effectiveMode === 'split') {
        jumpPreviewToHeading(heading);
        jumpEditorToHeading(heading, splitEditorRef);
        return;
      }
      jumpPreviewToHeading(heading);
    }
  }), [effectiveMode, jumpEditorToHeading, jumpPreviewToHeading]);

  const updateEditorActiveHeading = (lineNumber: number) => {
    let nextActiveId = '';
    headings.forEach(heading => {
      if (heading.line <= lineNumber) {
        nextActiveId = heading.id;
      }
    });
    if (onActiveHeadingChange) {
      onActiveHeadingChange(nextActiveId || (headings[0] && headings[0].id) || '');
    }
  };

  useEffect(() => {
    if (!onActiveHeadingChange || !headings.length || effectiveMode === 'editor') {
      return undefined;
    }

    let rafId = 0;
    const root = effectiveMode === 'split'
      ? splitViewerRef.current
      : viewerPaneRef.current;
    const rootScrollable = root && root.scrollHeight > root.clientHeight + 1;
    const scrollTargets = rootScrollable ? [root, window] : [window];

    const updateActiveHeading = () => {
      rafId = 0;
      const headingElements = headings
        .map(heading => ({ heading, element: document.getElementById(heading.id) }))
        .filter((item): item is { heading: MarkdownHeading; element: HTMLElement } => item.element !== null);
      if (!headingElements.length) return;

      const anchorTop = rootScrollable
        ? root.getBoundingClientRect().top + 24
        : 190;
      let nextActiveId = headingElements[0].heading.id;

      headingElements.forEach(item => {
        if (item.element.getBoundingClientRect().top <= anchorTop) {
          nextActiveId = item.heading.id;
        }
      });

      onActiveHeadingChange(nextActiveId);
    };

    const scheduleUpdate = () => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(updateActiveHeading);
    };

    scheduleUpdate();
    scrollTargets.forEach(target => target.addEventListener('scroll', scheduleUpdate, { passive: true }));
    window.addEventListener('resize', scheduleUpdate);

    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      scrollTargets.forEach(target => target.removeEventListener('scroll', scheduleUpdate));
      window.removeEventListener('resize', scheduleUpdate);
    };
  }, [effectiveMode, headings, onActiveHeadingChange]);

  useEffect(() => {
    if (effectiveMode !== 'split') return undefined;
    const editorScroll = splitEditorRef.current && splitEditorRef.current.getScrollElement
      ? splitEditorRef.current.getScrollElement()
      : null;
    const previewScroll = splitViewerRef.current;
    if (!editorScroll || !previewScroll) return undefined;

    const scrollRatio = (source: HTMLElement) => {
      const maxScrollTop = Math.max(0, source.scrollHeight - source.clientHeight);
      return maxScrollTop ? source.scrollTop / maxScrollTop : 0;
    };

    const applyRatio = (target: HTMLElement, ratio: number) => {
      const maxScrollTop = Math.max(0, target.scrollHeight - target.clientHeight);
      target.scrollTop = maxScrollTop * Math.max(0, Math.min(1, ratio));
    };

    const sync = (source: HTMLElement, target: HTMLElement) => {
      if (splitSyncLockRef.current) return;
      splitSyncLockRef.current = true;
      if (splitSyncFrameRef.current) window.cancelAnimationFrame(splitSyncFrameRef.current);
      splitSyncFrameRef.current = window.requestAnimationFrame(() => {
        applyRatio(target, scrollRatio(source));
        splitSyncFrameRef.current = 0;
        window.setTimeout(() => {
          splitSyncLockRef.current = false;
        }, 0);
      });
    };

    const syncEditorToPreview = () => sync(editorScroll, previewScroll);
    const syncPreviewToEditor = () => sync(previewScroll, editorScroll);

    editorScroll.addEventListener('scroll', syncEditorToPreview, { passive: true });
    previewScroll.addEventListener('scroll', syncPreviewToEditor, { passive: true });

    return () => {
      if (splitSyncFrameRef.current) {
        window.cancelAnimationFrame(splitSyncFrameRef.current);
        splitSyncFrameRef.current = 0;
      }
      splitSyncLockRef.current = false;
      editorScroll.removeEventListener('scroll', syncEditorToPreview);
      previewScroll.removeEventListener('scroll', syncPreviewToEditor);
    };
  }, [effectiveMode]);

  return (
    <div className={`docs-workspace mode-${effectiveMode}`}>
      <div className="docs-filebar" title={fileName || title}>
        <IconFile />
        <span>{fileName || title}</span>
      </div>
      <div className="docs-floating-actions">
        {canEdit && effectiveMode !== 'viewer' ? (
          <Input
            className="doc-project-title-input"
            value={title}
            onChange={event => onTitleChange(event.target.value)}
            placeholder="文档标题"
          />
        ) : null}
        {canEdit ? (
          <Radio.Group
            value={effectiveMode}
            onChange={event => onModeChange(event.target.value as DocsWorkspaceMode)}
            buttonStyle="solid"
          >
            {modes.map(item => (
              <Radio.Button key={item.value} value={item.value}>{item.label}</Radio.Button>
            ))}
          </Radio.Group>
        ) : null}
        {canEdit ? (
          <Button type="primary" disabled={!dirty} onClick={onSave}>
            保存
          </Button>
        ) : null}
      </div>
      <div className="docs-workspace-body">
        {effectiveMode === 'viewer' ? (
          <div className="docs-viewer-pane" ref={viewerPaneRef}>
            <MarkdownPreview value={content} />
          </div>
        ) : null}
        {effectiveMode === 'editor' ? (
          <div className="docs-editor-pane">
            <MarkdownRawEditor
              ref={editorRef}
              value={content}
              onChange={onContentChange}
              onActiveLineChange={updateEditorActiveHeading}
            />
          </div>
        ) : null}
        {effectiveMode === 'split' ? (
          <div className="docs-split-pane">
            <div className="split-editor">
              <MarkdownRawEditor
                ref={splitEditorRef}
                value={content}
                onChange={onContentChange}
                onActiveLineChange={updateEditorActiveHeading}
              />
            </div>
            <div className="split-viewer" ref={splitViewerRef}>
              <MarkdownPreview value={content} />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
});

function IconFile() {
  return <span className="docs-filebar-icon">md</span>;
}

export default DocsWorkspace;

DocsWorkspace.propTypes = {
  canEdit: PropTypes.bool,
  dirty: PropTypes.bool,
  fileName: PropTypes.string,
  mode: PropTypes.oneOf(['viewer', 'editor', 'split']),
  title: PropTypes.string,
  content: PropTypes.string,
  onModeChange: PropTypes.func as PropTypes.Validator<DocsWorkspaceProps['onModeChange']>,
  onTitleChange: PropTypes.func as PropTypes.Validator<DocsWorkspaceProps['onTitleChange']>,
  onContentChange: PropTypes.func as PropTypes.Validator<DocsWorkspaceProps['onContentChange']>,
  onActiveHeadingChange: PropTypes.func,
  onSave: PropTypes.func
};
