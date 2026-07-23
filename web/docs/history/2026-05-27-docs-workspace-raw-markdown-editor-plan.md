> Migration note: copied from `docs/superpowers/plans/2026-05-27-docs-workspace-raw-markdown-editor.md` at parent source baseline `19d6d428f544bb2da94337d6613a697e0c67819c`. Paths in this historical document describe the pre-split workspace.

# Docs Workspace Raw Markdown Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the docs project WYSIWYG editor with a CodeMirror 6 raw Markdown editor, add viewer/editor/split modes, and add a floating outline without changing docs APIs or ordinary project Wiki.

**Architecture:** Keep `DocsInterface` as the route-level container for document tree and CRUD. Move right-side document reading/editing into focused docs components: heading parsing utilities, Markdown preview with stable anchors, CodeMirror raw editor, outline, and workspace shell. Dirty-state confirmation remains in `DocsInterface` because left-tree navigation and document switching live there.

**Tech Stack:** React 18 class/container components, antd, Redux promise actions, markdown-it, CodeMirror 6, AVA, Vite.

---

## File Structure

- Create `yapi/client/components/Docs/markdownHeadings.js`
  - Owns heading extraction, stable slug generation, and Markdown render helper setup.
  - Must ignore fenced code blocks by using `markdown-it` tokens.
- Create `yapi/test/common/docs-markdown-headings.test.js`
  - Unit tests for heading extraction, duplicate heading ids, and fenced-code exclusion.
- Modify `yapi/client/components/Docs/MarkdownPreview.js`
  - Reuse `markdownHeadings.js` so preview heading ids match outline ids.
- Create `yapi/client/components/Docs/MarkdownOutline.js`
  - Displays heading tree and scrolls preview headings into view.
- Create `yapi/client/components/Docs/MarkdownRawEditor.js`
  - Wraps CodeMirror 6 as a controlled Markdown editor.
- Create `yapi/client/components/Docs/DocsWorkspace.js`
  - Owns title input, mode switch, save button, viewer/editor/split layout, and outline placement.
- Modify `yapi/client/components/Docs/docs.scss`
  - Add layout and visual styles for raw editor, split panes, toolbar, and floating outline.
- Modify `yapi/client/containers/Project/Interface/Docs/DocsInterface.js`
  - Replace `MilkdownEditor` direct rendering with `DocsWorkspace`.
  - Add dirty-state handling for document switch, route leave, browser unload, and delete current doc.
- Modify `yapi/client/containers/Project/Interface/Docs/docsInterface.scss`
  - Keep only route-specific layout overrides and remove Milkdown-specific styling.
- Modify `yapi/package.json` and `yapi/package-lock.json`
  - Add explicit direct dependencies for the CodeMirror packages used by `MarkdownRawEditor`.

## Task 1: Heading Parser and Preview Anchor Tests

**Files:**
- Create: `yapi/client/components/Docs/markdownHeadings.js`
- Create: `yapi/test/common/docs-markdown-headings.test.js`
- Modify: `yapi/client/components/Docs/MarkdownPreview.js`

- [ ] **Step 1: Write failing tests for heading parsing**

Create `yapi/test/common/docs-markdown-headings.test.js`:

```js
import test from 'ava';
import { extractHeadings } from '../../client/components/Docs/markdownHeadings.js';

test('extractHeadings returns stable slug ids and levels', t => {
  const headings = extractHeadings('# 工作区规范\n\n## API 文档\n\n### API 文档\n');

  t.deepEqual(headings, [
    { id: 'heading-ijp-foc-gfu-r7o-pvn', level: 1, text: '工作区规范' },
    { id: 'heading-api-k1z-kmb', level: 2, text: 'API 文档' },
    { id: 'heading-api-k1z-kmb-2', level: 3, text: 'API 文档' }
  ]);
});

test('extractHeadings ignores headings inside fenced code blocks', t => {
  const headings = extractHeadings([
    '# Visible',
    '',
    '```md',
    '# Hidden',
    '```',
    '',
    '## Also Visible'
  ].join('\n'));

  t.deepEqual(headings.map(item => item.text), ['Visible', 'Also Visible']);
});

test('extractHeadings returns an empty list for docs without headings', t => {
  t.deepEqual(extractHeadings('plain text\n\n- list item'), []);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm --prefix yapi test -- test/common/docs-markdown-headings.test.js
```

Expected: fail with a module-not-found error for `markdownHeadings.js`.

- [ ] **Step 3: Implement heading utilities**

Create `yapi/client/components/Docs/markdownHeadings.js`:

```js
import MarkdownIt from 'markdown-it';

export const markdownRenderer = new MarkdownIt({ html: false, linkify: true, breaks: true });

function slugify(text) {
  const normalized = String(text || '')
    .trim()
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!normalized) return 'section';
  return normalized
    .split('')
    .map(char => (/[\u4e00-\u9fa5]/.test(char) ? `-${char.charCodeAt(0).toString(36)}-` : char))
    .join('')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function extractHeadings(markdown) {
  const tokens = markdownRenderer.parse(markdown || '', {});
  const used = {};
  const headings = [];

  tokens.forEach((token, index) => {
    if (token.type !== 'heading_open') return;
    const inline = tokens[index + 1];
    const level = Number(String(token.tag || 'h1').replace('h', '')) || 1;
    const text = inline && inline.type === 'inline' ? inline.content : '';
    const base = `heading-${slugify(text)}`;
    used[base] = (used[base] || 0) + 1;
    const id = used[base] === 1 ? base : `${base}-${used[base]}`;

    headings.push({ id, level, text });
  });

  return headings;
}

export function renderMarkdownWithHeadingIds(markdown) {
  const headings = extractHeadings(markdown);
  let cursor = 0;

  markdownRenderer.renderer.rules.heading_open = function headingOpen(tokens, idx, options, env, self) {
    const heading = headings[cursor];
    cursor += 1;
    if (heading) tokens[idx].attrSet('id', heading.id);
    return self.renderToken(tokens, idx, options);
  };

  const html = markdownRenderer.render(markdown || '');
  return { html, headings };
}
```

- [ ] **Step 4: Update `MarkdownPreview` to use shared render helper**

Replace `yapi/client/components/Docs/MarkdownPreview.js` with:

```js
import React from 'react';
import PropTypes from 'prop-types';
import { sanitizeHTML } from 'common/sanitize.js';
import { renderMarkdownWithHeadingIds } from './markdownHeadings';

export default function MarkdownPreview({ value, className }) {
  const { html } = renderMarkdownWithHeadingIds(value || '');
  const cls = className ? `apimind-docs-rendered ${className}` : 'apimind-docs-rendered';
  return (
    <div
      className={cls}
      dangerouslySetInnerHTML={{ __html: sanitizeHTML(html) }}
    />
  );
}

MarkdownPreview.propTypes = {
  value: PropTypes.string,
  className: PropTypes.string
};
```

- [ ] **Step 5: Run tests and commit**

Run:

```bash
npm --prefix yapi test -- test/common/docs-markdown-headings.test.js
npm --prefix yapi run build
```

Expected: AVA tests pass; Vite build completes.

Commit:

```bash
git add yapi/client/components/Docs/markdownHeadings.js yapi/client/components/Docs/MarkdownPreview.js yapi/test/common/docs-markdown-headings.test.js
git commit -m "test: cover docs markdown heading anchors"
```

## Task 2: CodeMirror Raw Markdown Editor

**Files:**
- Create: `yapi/client/components/Docs/MarkdownRawEditor.js`
- Modify: `yapi/package.json`
- Modify: `yapi/package-lock.json`

- [ ] **Step 1: Add explicit CodeMirror dependencies**

Run:

```bash
npm --prefix yapi install codemirror @codemirror/lang-markdown @codemirror/language @codemirror/state @codemirror/view @codemirror/commands --save
```

Expected: `yapi/package.json` has direct dependencies for the listed CodeMirror packages and lockfile updates without removing unrelated dependencies.

- [ ] **Step 2: Create controlled CodeMirror component**

Create `yapi/client/components/Docs/MarkdownRawEditor.js`:

```js
import React, { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import { defaultHighlightStyle, syntaxHighlighting } from '@codemirror/language';

export default function MarkdownRawEditor({ value, onChange, readOnly }) {
  const rootRef = useRef(null);
  const viewRef = useRef(null);
  const valueRef = useRef(value || '');
  const onChangeRef = useRef(onChange);
  const suppressChangeRef = useRef(false);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!rootRef.current) return undefined;

    const updateListener = EditorView.updateListener.of(update => {
      if (!update.docChanged) return;
      const nextValue = update.state.doc.toString();
      valueRef.current = nextValue;
      if (suppressChangeRef.current) return;
      if (onChangeRef.current) onChangeRef.current(nextValue);
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
        EditorView.editable.of(!readOnly),
        updateListener
      ]
    });

    const view = new EditorView({ state, parent: rootRef.current });
    viewRef.current = view;
    valueRef.current = value || '';

    return () => {
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

  return <div className="apimind-raw-editor" ref={rootRef} />;
}

MarkdownRawEditor.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func,
  readOnly: PropTypes.bool
};
```

- [ ] **Step 3: Run build and commit**

Run:

```bash
npm --prefix yapi run build
```

Expected: build succeeds and imports resolve.

Clean build output:

```bash
git -C yapi clean -fd -- static/prd
git -C yapi checkout -- static/prd/.vite/manifest.json
```

Commit:

```bash
git add yapi/package.json yapi/package-lock.json yapi/client/components/Docs/MarkdownRawEditor.js
git commit -m "feat: add raw markdown editor component"
```

## Task 3: Docs Workspace Component with Viewer/Edit/Split Modes

**Files:**
- Create: `yapi/client/components/Docs/MarkdownOutline.js`
- Create: `yapi/client/components/Docs/DocsWorkspace.js`
- Modify: `yapi/client/components/Docs/docs.scss`

- [ ] **Step 1: Create outline component**

Create `yapi/client/components/Docs/MarkdownOutline.js`:

```js
import React from 'react';
import PropTypes from 'prop-types';
import { extractHeadings } from './markdownHeadings';

export default function MarkdownOutline({ value, rootSelector, clickable = true }) {
  const headings = extractHeadings(value || '');

  if (!headings.length) {
    return null;
  }

  const jumpTo = id => {
    const root = rootSelector ? document.querySelector(rootSelector) : document;
    const target = root && root.querySelector ? root.querySelector(`#${id}`) : document.getElementById(id);
    if (target) {
      target.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
  };

  return (
    <nav className="apimind-doc-outline">
      <div className="outline-title">目录</div>
      {headings.map(heading => {
        const className = `outline-item level-${heading.level}${clickable ? '' : ' is-static'}`;
        return clickable ? (
          <button
            key={heading.id}
            type="button"
            className={className}
            onClick={() => jumpTo(heading.id)}
          >
            {heading.text}
          </button>
        ) : (
          <span key={heading.id} className={className}>
            {heading.text}
          </span>
        );
      })}
    </nav>
  );
}

MarkdownOutline.propTypes = {
  value: PropTypes.string,
  rootSelector: PropTypes.string,
  clickable: PropTypes.bool
};
```

- [ ] **Step 2: Create docs workspace component**

Create `yapi/client/components/Docs/DocsWorkspace.js`:

```js
import React from 'react';
import PropTypes from 'prop-types';
import { Button, Input, Radio } from 'antd';
import MarkdownPreview from './MarkdownPreview';
import MarkdownRawEditor from './MarkdownRawEditor';
import MarkdownOutline from './MarkdownOutline';

const modes = [
  { label: '预览', value: 'viewer' },
  { label: '编辑', value: 'editor' },
  { label: '分屏', value: 'split' }
];

export default function DocsWorkspace(props) {
  const {
    canEdit,
    dirty,
    mode,
    title,
    content,
    onModeChange,
    onTitleChange,
    onContentChange,
    onSave
  } = props;
  const effectiveMode = canEdit ? mode : 'viewer';

  return (
    <div className={`docs-workspace mode-${effectiveMode}`}>
      <div className="docs-workspace-toolbar">
        <div className="docs-title-area">
          {canEdit && effectiveMode !== 'viewer' ? (
            <Input
              className="doc-project-title-input"
              value={title}
              onChange={event => onTitleChange(event.target.value)}
              placeholder="文档标题"
            />
          ) : (
            <h1>{title}</h1>
          )}
        </div>
        <div className="docs-toolbar-actions">
          {canEdit ? (
            <Radio.Group
              value={effectiveMode}
              onChange={event => onModeChange(event.target.value)}
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
      </div>
      <div className="docs-workspace-body">
        {effectiveMode === 'viewer' ? (
          <div className="docs-viewer-pane">
            <MarkdownPreview value={content} />
            <MarkdownOutline value={content} rootSelector=".docs-viewer-pane" />
          </div>
        ) : null}
        {effectiveMode === 'editor' ? (
          <div className="docs-editor-pane">
            <MarkdownRawEditor value={content} onChange={onContentChange} />
            <MarkdownOutline value={content} clickable={false} />
          </div>
        ) : null}
        {effectiveMode === 'split' ? (
          <div className="docs-split-pane">
            <div className="split-editor">
              <MarkdownRawEditor value={content} onChange={onContentChange} />
            </div>
            <div className="split-viewer">
              <MarkdownPreview value={content} />
              <MarkdownOutline value={content} rootSelector=".split-viewer" />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

DocsWorkspace.propTypes = {
  canEdit: PropTypes.bool,
  dirty: PropTypes.bool,
  mode: PropTypes.oneOf(['viewer', 'editor', 'split']),
  title: PropTypes.string,
  content: PropTypes.string,
  onModeChange: PropTypes.func,
  onTitleChange: PropTypes.func,
  onContentChange: PropTypes.func,
  onSave: PropTypes.func
};
```

- [ ] **Step 3: Add workspace styles**

Append to `yapi/client/components/Docs/docs.scss`:

```scss
.docs-workspace {
  min-height: calc(100vh - 220px);
  background: #fff;

  .docs-workspace-toolbar {
    position: sticky;
    top: 0;
    z-index: 5;
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 64px;
    padding: 14px 24px;
    border-bottom: 1px solid #f0f0f0;
    background: #fff;
  }

  .docs-title-area {
    min-width: 0;
    flex: 1 1 auto;

    h1 {
      margin: 0;
      font-size: 24px;
      line-height: 34px;
      font-weight: 500;
    }
  }

  .docs-toolbar-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-left: 16px;
  }

  .docs-workspace-body {
    min-height: 560px;
  }

  .docs-viewer-pane,
  .docs-editor-pane,
  .split-viewer {
    position: relative;
  }

  .docs-viewer-pane,
  .docs-editor-pane {
    padding: 24px 260px 40px 32px;
  }

  .docs-split-pane {
    display: grid;
    grid-template-columns: minmax(360px, 1fr) minmax(360px, 1fr);
    min-height: 640px;
  }

  .split-editor {
    min-width: 0;
    border-right: 1px solid #f0f0f0;
  }

  .split-viewer {
    min-width: 0;
    padding: 24px 240px 40px 32px;
    overflow: auto;
  }

  .apimind-raw-editor {
    min-height: 640px;
    border: 0;

    .cm-editor {
      min-height: 640px;
      font-size: 14px;
      line-height: 1.7;
    }

    .cm-scroller {
      font-family: Menlo, Monaco, Consolas, 'Courier New', monospace;
    }
  }

  .apimind-doc-outline {
    position: absolute;
    top: 24px;
    right: 16px;
    width: 200px;
    max-height: calc(100vh - 220px);
    overflow: auto;
    padding-left: 12px;
    border-left: 1px solid #f0f0f0;
    background: rgba(255, 255, 255, 0.96);
  }

  .outline-title {
    margin-bottom: 8px;
    color: #8c8c8c;
    font-size: 12px;
    line-height: 20px;
  }

  .outline-item {
    display: block;
    width: 100%;
    border: 0;
    padding: 4px 0;
    background: transparent;
    color: #666;
    text-align: left;
    font-size: 13px;
    line-height: 20px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    cursor: pointer;
  }

  .outline-item:hover {
    color: #1890ff;
  }

  .outline-item.is-static {
    cursor: default;
  }

  .outline-item.is-static:hover {
    color: #666;
  }

  .outline-item.level-2 { padding-left: 10px; }
  .outline-item.level-3 { padding-left: 20px; }
  .outline-item.level-4,
  .outline-item.level-5,
  .outline-item.level-6 { padding-left: 30px; }
}

@media (max-width: 1280px) {
  .docs-workspace {
    .docs-viewer-pane,
    .docs-editor-pane,
    .split-viewer {
      padding-right: 32px;
    }

    .apimind-doc-outline {
      display: none;
    }
  }
}
```

- [ ] **Step 4: Run build and commit**

Run:

```bash
npm --prefix yapi run build
```

Expected: build succeeds.

Clean build output:

```bash
git -C yapi clean -fd -- static/prd
git -C yapi checkout -- static/prd/.vite/manifest.json
```

Commit:

```bash
git add yapi/client/components/Docs/MarkdownOutline.js yapi/client/components/Docs/DocsWorkspace.js yapi/client/components/Docs/docs.scss
git commit -m "feat: add docs workspace viewer editor split layout"
```

## Task 4: Integrate Workspace and Dirty-State Guards

**Files:**
- Modify: `yapi/client/containers/Project/Interface/Docs/DocsInterface.js`
- Modify: `yapi/client/containers/Project/Interface/Docs/docsInterface.scss`

- [ ] **Step 1: Replace direct editor imports**

In `yapi/client/containers/Project/Interface/Docs/DocsInterface.js`, replace:

```js
import MarkdownPreview from '../../../../components/Docs/MarkdownPreview';
import MilkdownEditor from '../../../../components/Docs/MilkdownEditor';
```

with:

```js
import DocsWorkspace from '../../../../components/Docs/DocsWorkspace';
```

- [ ] **Step 2: Extend state for mode and original snapshot**

Replace the current initial state block with:

```js
  state = {
    filter: '',
    mode: 'viewer',
    title: '',
    content: '',
    originalTitle: '',
    originalContent: '',
    pendingDocId: null,
    confirmVisible: false,
    renameVisible: false,
    renameDoc: null,
    renameTitle: ''
  };
```

- [ ] **Step 3: Add dirty helper, unload guard, and route-change guard**

Add methods inside `DocsInterface`:

```js
  isDirty() {
    return this.state.title !== this.state.originalTitle ||
      this.state.content !== this.state.originalContent;
  }

  bindBeforeUnload() {
    window.addEventListener('beforeunload', this.handleBeforeUnload);
  }

  unbindBeforeUnload() {
    window.removeEventListener('beforeunload', this.handleBeforeUnload);
  }

  handleBeforeUnload = event => {
    if (!this.isDirty()) return undefined;
    event.preventDefault();
    event.returnValue = '';
    return '';
  };
```

Replace the existing lifecycle methods with dirty-aware versions. The `isRestoringLocation` instance flag prevents the protection redirect from recursively prompting after restoring the previous URL:

```js
  componentDidMount() {
    this.bindBeforeUnload();
    this.loadDocs();
  }

  componentDidUpdate(prevProps) {
    const prevProject = prevProps.match.params.id;
    const nextProject = this.props.match.params.id;
    const prevDoc = this.docIdFromPath(prevProps.location && prevProps.location.pathname);
    const nextDoc = this.docIdFromPath(this.props.location && this.props.location.pathname);

    if (this.isRestoringLocation) {
      this.isRestoringLocation = false;
      return;
    }

    if (prevProject !== nextProject) {
      this.loadDocs();
      return;
    }

    if (prevDoc !== nextDoc) {
      if (this.isDirty()) {
        this.setState({
          pendingDocId: nextDoc || 'root',
          confirmVisible: true
        });
        this.isRestoringLocation = true;
        this.props.history.replace(prevProps.location.pathname);
        return;
      }
      if (nextDoc && !isNaN(nextDoc)) {
        this.selectDoc(nextDoc);
      }
    }
  }

  componentWillUnmount() {
    this.unbindBeforeUnload();
  }
```

This covers left-tree clicks, browser back/forward, and direct `history.push` calls inside the docs route. Browser/tab close remains covered by `beforeunload`.

- [ ] **Step 4: Preserve dirty content when selecting documents**

Replace `selectDoc` with:

```js
  selectDoc = async id => {
    const res = yapiData(await this.props.fetchDoc(id));
    if (res.errcode === 0) {
      const title = res.data.title || '';
      const content = res.data.content_md || '';
      this.setState({
        mode: 'viewer',
        title,
        content,
        originalTitle: title,
        originalContent: content,
        pendingDocId: null,
        confirmVisible: false
      });
    } else {
      message.error(res.errmsg);
    }
  };
```

- [ ] **Step 5: Set new docs to editor mode with clean snapshot**

In `createNewDoc`, replace the final `setState` block with:

```js
    this.setState({
      mode: 'editor',
      title: res.data.title,
      content: res.data.content_md || '',
      originalTitle: res.data.title,
      originalContent: res.data.content_md || ''
    });
```

- [ ] **Step 6: Add dirty-aware document selection**

Replace `onSelect` with:

```js
  onSelect = selectedKeys => {
    const key = selectedKeys[0];
    if (!key || key === 'root') {
      if (this.isDirty()) {
        this.setState({ pendingDocId: 'root', confirmVisible: true });
        return;
      }
      this.props.history.push(`/project/${this.projectId()}/interface/api`);
      return;
    }
    if (this.isDirty()) {
      this.setState({ pendingDocId: key, confirmVisible: true });
      return;
    }
    this.props.history.push(`/project/${this.projectId()}/interface/api/${key}`);
  };
```

Add confirm handlers:

```js
  continueToPendingDoc = () => {
    const target = this.state.pendingDocId;
    this.setState({
      confirmVisible: false,
      pendingDocId: null,
      title: this.state.originalTitle,
      content: this.state.originalContent
    }, () => {
      if (!target || target === 'root') {
        this.props.history.push(`/project/${this.projectId()}/interface/api`);
        return;
      }
      this.props.history.push(`/project/${this.projectId()}/interface/api/${target}`);
    });
  };

  saveAndContinue = async () => {
    const ok = await this.saveDoc();
    if (ok) this.continueToPendingDoc();
  };
```

- [ ] **Step 7: Protect deleting the current dirty document**

Refactor the existing delete logic into a helper:

```js
  deleteDocItem = async item => {
    const res = yapiData(await this.props.deleteDoc(item.id));
    if (res.errcode !== 0) {
      message.error(res.errmsg);
      return;
    }
    message.success('文档已删除');
    const listRes = yapiData(await this.refreshDocs());
    const next = listRes.data && listRes.data.find(doc => doc.id !== item.id);
    if (next) {
      this.props.history.push(`/project/${this.projectId()}/interface/api/${next.id}`);
    } else {
      this.props.history.push(`/project/${this.projectId()}/interface/api`);
    }
  };
```

Replace `showDeleteConfirm` with a version that warns before deleting the currently edited dirty doc:

```js
  showDeleteConfirm = item => {
    if (!this.canEdit()) {
      return;
    }
    const isCurrent = this.props.current && Number(this.props.current.id) === Number(item.id);
    const dirtyCurrent = isCurrent && this.isDirty();
    Modal.confirm({
      title: dirtyCurrent ? '当前文档有未保存修改，仍要删除吗？' : '您确认删除此文档吗？',
      content: dirtyCurrent ? '删除当前文档会丢失未保存修改。' : '文档删除后不会在列表中显示。',
      okText: '确认',
      cancelText: '取消',
      onOk: () => this.deleteDocItem(item)
    });
  };
```

- [ ] **Step 8: Make save return success status and preserve mode**

Replace `saveDoc` with:

```js
  saveDoc = async () => {
    const current = this.props.current;
    const title = String(this.state.title || '').trim();
    if (!current || !this.canEdit()) {
      return false;
    }
    if (!title) {
      message.error('文档标题不能为空');
      return false;
    }
    const res = yapiData(await this.props.updateDoc({
      id: current.id,
      title,
      content_md: this.state.content,
      doc_type: current.doc_type || 'markdown',
      tags: current.tags || []
    }));
    if (res.errcode !== 0) {
      message.error(res.errmsg);
      return false;
    }
    message.success('保存成功');
    await this.props.fetchDocs(this.workspaceId(), this.projectId());
    this.setState({
      title,
      originalTitle: title,
      originalContent: this.state.content
    });
    return true;
  };
```

- [ ] **Step 9: Render `DocsWorkspace` and dirty confirm modal**

Replace `renderContent` with:

```js
  renderContent() {
    const { current } = this.props;
    if (!current) {
      return (
        <div className="doc-project-empty">
          <Empty description="暂无文档" />
          {this.canEdit() ? <Button type="primary" onClick={() => this.createNewDoc(0)}>新建文档</Button> : null}
        </div>
      );
    }
    return (
      <div className="interface-content doc-project-content">
        <DocsWorkspace
          canEdit={this.canEdit()}
          dirty={this.isDirty()}
          mode={this.state.mode}
          title={this.state.title}
          content={this.state.content}
          onModeChange={mode => this.setState({ mode })}
          onTitleChange={title => this.setState({ title })}
          onContentChange={content => this.setState({ content })}
          onSave={this.saveDoc}
        />
      </div>
    );
  }
```

Render the dirty confirm modal next to the rename modal:

```jsx
            <Modal
              title="当前文档有未保存修改"
              open={this.state.confirmVisible}
              onCancel={() => this.setState({ confirmVisible: false, pendingDocId: null })}
              footer={[
                <Button key="cancel" onClick={() => this.setState({ confirmVisible: false, pendingDocId: null })}>取消</Button>,
                <Button key="discard" onClick={this.continueToPendingDoc}>放弃修改</Button>,
                <Button key="save" type="primary" onClick={this.saveAndContinue}>保存并切换</Button>
              ]}
            >
              <p>切换文档会离开当前编辑内容，请选择如何处理未保存修改。</p>
            </Modal>
```

- [ ] **Step 10: Remove Milkdown-specific route styles**

In `yapi/client/containers/Project/Interface/Docs/docsInterface.scss`, remove the `.apimind-milkdown-editor` block and keep only route layout styles:

```scss
.doc-project-menu {
  .ant-tabs.ant-tabs-card > .ant-tabs-bar .ant-tabs-tab {
    min-width: 100%;
  }

  .doc-project-title {
    padding-right: 108px;

    .btns {
      min-width: 104px;
    }
  }
}

.doc-project-content {
  min-height: calc(100vh - 220px);

  .doc-project-empty {
    padding: 24px 32px;
  }
}

.doc-project-empty {
  text-align: center;
}
```

- [ ] **Step 11: Build and commit**

Run:

```bash
npm --prefix yapi run build
```

Expected: build succeeds.

Clean build output:

```bash
git -C yapi clean -fd -- static/prd
git -C yapi checkout -- static/prd/.vite/manifest.json
```

Commit:

```bash
git add yapi/client/containers/Project/Interface/Docs/DocsInterface.js yapi/client/containers/Project/Interface/Docs/docsInterface.scss
git commit -m "feat: wire raw markdown workspace into docs project"
```

## Task 5: Browser Smoke and Regression Verification

**Files:**
- Modify: `apimind/docs/test-reports/2026-05-26-workspace-project-docs-milkdown.md`

- [ ] **Step 1: Verify docs project UI**

Open the running dev UI at a known docs project URL, for example:

```text
http://127.0.0.1:4001/project/33/interface/api/14
```

Verify:

- Top project nav remains visible.
- Left document tree remains visible and selectable.
- Right toolbar shows `预览 / 编辑 / 分屏`.
- `编辑` shows CodeMirror raw Markdown, not Milkdown.
- `分屏` shows editor and preview side by side.
- Outline appears when headings exist.
- Outline is hidden when a document has no headings.

- [ ] **Step 2: Verify dirty-state behavior**

In the browser:

1. Enter `编辑` mode.
2. Change Markdown text without saving.
3. Click another document in the left tree.

Expected:

- A confirm modal appears with `保存并切换`、`放弃修改`、`取消`.
- `取消` keeps the user on the current document with edits intact.
- `放弃修改` switches documents and discards edits.
- `保存并切换` saves then switches.

- [ ] **Step 3: Verify ordinary project regressions**

Open:

```text
http://127.0.0.1:4001/project/26/wiki
http://127.0.0.1:4001/project/26/interface/api
```

Expected:

- `/wiki` uses the original `yapi-plugin-wiki` page.
- Ordinary interface list still loads.
- No `DocsWorkspace` UI appears in ordinary projects.

- [ ] **Step 4: Update test report**

Append the following lines under `## Browser Smoke` in `apimind/docs/test-reports/2026-05-26-workspace-project-docs-milkdown.md`:

```md
- Docs workspace raw Markdown editor is CodeMirror-based and Milkdown is not rendered: PASS
- Docs workspace mode switch supports `预览 / 编辑 / 分屏`: PASS
- Split mode shows raw editor and Markdown viewer side by side: PASS
- Floating outline renders headings, ignores fenced code headings, and hides for no-heading docs: PASS
- Dirty-state confirmation protects unsaved edits when switching documents: PASS
```

- [ ] **Step 5: Final verification and commit**

Run:

```bash
npm --prefix yapi run build
git diff --check
```

Expected: build succeeds and diff check is clean.

Clean build output:

```bash
git -C yapi clean -fd -- static/prd
git -C yapi checkout -- static/prd/.vite/manifest.json
```

Commit:

```bash
git add apimind/docs/test-reports/2026-05-26-workspace-project-docs-milkdown.md
git commit -m "test: document raw markdown workspace smoke"
```

## Implementation Notes

- Do not modify docs backend handlers, services, repositories, or `.api` files for this feature.
- Do not modify ordinary project Wiki beyond verifying it still uses `yapi-plugin-wiki`.
- Do not remove Milkdown dependencies in this implementation unless a separate cleanup task is requested.
- Keep build artifacts out of commits: clean `yapi/static/prd` after every Vite build.
- If a task runs in a dirty worktree, stage only the files listed in that task.
