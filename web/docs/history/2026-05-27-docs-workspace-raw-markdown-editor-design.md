> Migration note: copied from `docs/superpowers/specs/2026-05-27-docs-workspace-raw-markdown-editor-design.md` at parent source baseline `19d6d428f544bb2da94337d6613a697e0c67819c`. Paths in this historical document describe the pre-split workspace.

# 文档工作区 Raw Markdown Editor 设计

## 背景

当前 `kind=docs` 项目复用普通 Project 外壳和 `/project/:id/interface/api` 路由，左侧沿用接口列表风格的文档树，右侧是文档内容工作区。

现有右侧工作区使用 `MilkdownEditor` 做 WYSIWYG Markdown 编辑，预览使用 `MarkdownPreview` 基于 `markdown-it` 渲染。用户希望文档工作区改为更直接的 Raw Markdown 编辑体验：

- 使用 Markdown Viewer + CodeMirror Raw Editor。
- 右上角快速切换预览、编辑、分屏模式。
- 分屏模式同时显示编辑器和预览。
- 右侧提供浮动 outline 目录导航。

## 目标

1. 将文档工作区的编辑体验从 Milkdown 替换为 CodeMirror 6 Raw Markdown Editor。
2. 继续复用现有 `MarkdownPreview` 作为 Markdown Viewer。
3. 支持三种显示模式：
   - `预览`：只显示 Markdown Viewer。
   - `编辑`：只显示 CodeMirror Raw Editor。
   - `分屏`：左侧 Raw Editor，右侧 Viewer。
4. 在右侧展示浮动 outline，基于当前 Markdown heading 生成目录。
5. 保持现有文档树、文档 CRUD、路由、后端 API 和数据结构不变。

## 非目标

- 不改普通 Project Wiki，普通 Wiki 继续使用原 `yapi-plugin-wiki`。
- 不改 workspace/project/cat/interface 主流程。
- 不改 docs 后端 API。
- 不引入 Monaco。
- 不做协同编辑、评论、审批、版本管理。
- 不做 WYSIWYG 和 Raw 双编辑器混用。

## 当前实现依据

- 文档项目入口：`yapi/client/containers/Project/Interface/Interface.js`
  - 当 `curProject.kind === 'docs'` 时渲染文档工作区。
- 文档工作区：`yapi/client/containers/Project/Interface/Docs/DocsInterface.js`
  - 管理文档树、选中文档、创建、重命名、复制、删除、移动、保存。
  - 当前右侧用 `curtab: 'view' | 'edit'` 在预览和编辑之间切换。
- Markdown Viewer：`yapi/client/components/Docs/MarkdownPreview.js`
  - 使用 `markdown-it` 渲染，并通过 `sanitizeHTML` 过滤 HTML。
- 当前 WYSIWYG 编辑器：`yapi/client/components/Docs/MilkdownEditor.js`
  - 使用 `@milkdown/crepe`。
- 样式：
  - `yapi/client/components/Docs/docs.scss`
  - `yapi/client/containers/Project/Interface/Docs/docsInterface.scss`

## 设计方案

### 编辑器选择

采用 CodeMirror 6。

理由：

- 当前 `package-lock.json` 已包含 CodeMirror 6 相关包，适合 Markdown Raw Editor。
- 比 Monaco 更轻，Vite 集成成本更低。
- 对文档 Markdown 编辑场景足够。
- 能避免 Monaco worker、主题、包体和布局隔离的额外复杂度。

### 组件拆分

新增或替换为以下组件：

- `MarkdownRawEditor`
  - 封装 CodeMirror 6。
  - 输入：`value`、`onChange`、`readOnly`。
  - 使用 Markdown language extension。
  - 支持基础编辑快捷键、行号、软换行。
  - 必须响应外部 `value` 变化：切换文档或重新加载当前文档时，编辑器内容同步为新的 `content_md`。
  - 避免回声更新：CodeMirror 内部编辑触发 `onChange` 后，不应因为同值 props 回写导致光标跳动。

- `MarkdownOutline`
  - 从 Markdown 文本解析 `#` 到 `######` 标题。
  - 解析必须忽略 fenced code block 内的 `#`。
  - 优先复用 `markdown-it` token 解析 heading；若实现轻量解析，也必须显式处理 fenced code block。
  - 展示浮动目录。
  - 点击目录项滚动到 Viewer 中对应 heading。
  - 编辑模式下 outline 仍基于当前编辑内容实时更新。

- `DocsWorkspace`
  - 承载标题、模式切换、保存、编辑器、预览、分屏和 outline。
  - 由 `DocsInterface` 调用，减少 `DocsInterface` 继续膨胀。

### 模式切换

右上角使用 segmented control 或按钮组：

- `预览`
- `编辑`
- `分屏`

状态字段建议由当前 `curtab` 扩展为：

- `mode: 'viewer' | 'editor' | 'split'`

交互规则：

- 只读用户只展示 `预览`。
- 有编辑权限的用户可切换三种模式。
- 新建文档后默认进入 `编辑`。
- 保存成功后保持当前模式，不强制跳回预览。
- 切换模式不丢失未保存内容。

### 未保存状态

文档工作区必须跟踪 dirty 状态：

- 当 `title` 或 `content` 与当前文档原始值不一致时，标记为未保存。
- 保存成功后更新原始快照并清除 dirty 状态。
- 切换 `预览 / 编辑 / 分屏` 不触发保存，也不丢失未保存内容。
- 点击左侧文档树切换到其他文档时，如果当前文档 dirty，先弹出确认：
  - `保存并切换`
  - `放弃修改`
  - `取消`
- 刷新页面、离开路由或浏览器关闭前，如果 dirty，使用浏览器原生离开确认。
- 删除当前文档前如果 dirty，删除确认文案应说明未保存修改会丢弃。

### 布局

右侧工作区分为：

- 顶部工具条：
  - 左侧显示标题或标题输入。
  - 右侧显示模式切换和保存按钮。
- 内容区：
  - `viewer`：单栏 Viewer。
  - `editor`：单栏 CodeMirror。
  - `split`：左 Editor，右 Viewer。
- 右侧浮动 outline：
  - 固定在右侧内容区域内，不覆盖左侧文档树。
  - `viewer` 模式下，outline 作为内容区右侧浮层显示，预览正文右侧预留安全空白，避免遮挡文字。
  - `split` 模式下，outline 附着在预览 pane 内右侧；预览 pane 需要为 outline 预留宽度。
  - `editor` 模式下，outline 仍可显示，但只作为当前 Markdown 的标题索引，不滚动编辑器。
  - 不占用左侧文档树宽度。
  - 当内容区宽度不足时自动隐藏，避免压缩编辑器和预览。

### Markdown Viewer

继续使用 `MarkdownPreview`。

需要补充：

- heading id 生成要稳定，建议基于 heading 文本 slug 和出现序号，而不是行号。
- outline 使用同一套 heading 解析结果，避免目录项和预览锚点不一致。
- fenced code block 中的 heading-like 文本不生成 heading id，也不进入 outline。
- 继续禁用原始 HTML 或保持 sanitize，避免安全回归。

### 保存流程

保存仍调用现有 `updateDoc`：

- `id`
- `title`
- `content_md`
- `doc_type`
- `tags`

不新增后端字段，不改变 Mongo 文档结构。

### 错误处理

- CodeMirror 初始化失败时显示明确错误，不影响文档树。
- 保存失败时保留当前编辑内容并展示 `message.error`。
- 空文档继续显示空态和新建按钮。
- 无标题时沿用当前规则，禁止提交空标题。

## 测试计划

1. 构建验证：
   - `npm --prefix yapi run build`
2. 浏览器烟测：
   - 打开 `kind=docs` 项目的 `/project/:id/interface/api/:docId`。
   - 确认左侧文档树不受影响。
   - 确认 `预览 / 编辑 / 分屏` 三种模式可切换。
   - 编辑 Markdown 后预览实时更新。
   - 切换文档时 CodeMirror 内容同步为新文档内容。
   - 未保存修改时切换文档会出现确认，取消后仍停留当前文档。
   - 保存后刷新页面内容仍存在。
   - outline 能展示 heading，并能跳转到对应标题。
   - fenced code block 内的 `# title` 不进入 outline。
   - 无 heading 文档不显示空白 outline 占位或报错。
3. 回归：
   - 普通项目 `/project/:id/wiki` 仍是原 Wiki。
   - 普通接口列表 `/project/:id/interface/api` 不受影响。
   - 只读用户只能查看预览，不显示保存、编辑、分屏入口。

## 风险与取舍

- CodeMirror 6 若只存在于 lockfile 但未显式声明在 `package.json`，实现时应补齐直接依赖，避免隐式依赖风险。
- 分屏和 outline 会压缩内容宽度，需要 CSS 约束，避免小屏布局混乱。
- 当前 `MarkdownPreview` heading id 基于行号，后续应改为稳定 slug，避免编辑后目录跳转不稳定。
- Dirty 状态会影响左侧文档树切换、删除、刷新和路由离开；实现时必须集中处理，避免只在保存按钮附近做局部判断。
- Milkdown 依赖是否移除应单独评估；本次实现可以先停止使用，不强制清理依赖。

## 验收标准

- 文档工作区右上角能切换 `预览 / 编辑 / 分屏`。
- 编辑器为 Raw Markdown CodeMirror，不再是 Milkdown WYSIWYG。
- 分屏模式左编辑右预览，编辑内容能同步到预览。
- 右侧浮动 outline 显示当前文档标题层级，点击可跳转。
- outline 不识别 fenced code block 内的 `#` 文本。
- 切换文档时 CodeMirror 不保留旧文档内容。
- 未保存内容在切换文档或离开页面前有明确确认。
- 保存后 `content_md` 与编辑器内容一致。
- 只读用户没有编辑或保存入口。
- 普通 Wiki 和普通接口页无回归。
