> Migrated from `docs/prompts/apimind-contract-skill-maintenance-prompt.md` at integration-workspace baseline `19d6d428f544bb2da94337d6613a697e0c67819c`.
>
> This is a historical maintenance brief. Current package policy is defined by the two `SKILL.md` files and `compatibility/server.yaml`.

你是资深 AI Coding 工程化顾问 + Codex Skill 设计专家 + Go 后端架构师。

任务目标：
请分析当前仓库现有文件结构和文档约定，并新增/完善通用 ApiMind Codex Plugin 发布包。该发布包包含两个独立 skills：

- `apimind-project-config`：ApiMind Skill 工程项目配置与管理，维护目标仓库中的极简 AGENTS.md、可选 CLAUDE.md，以及 apimind-contract.yaml workspace/project 绑定配置
- `apimind-contract`：ApiMind 接口契约维护，通过 MCP 读取、搜索、创建或更新 cat/interface

本任务只允许修改文档/配置类文件，不允许修改业务代码，不实现 MCP Server，不改后端逻辑。

核心背景：
ApiMind 的真实层级是：

workspace / project / cat / interface

中文统一命名是：

工作区 / 项目 / 接口分组 / 接口

术语规则：
- `workspace` 是标准英文名，中文为“工作区”
- `project` 是标准英文名，中文为“项目”
- `cat` 是标准英文名，中文为“接口分组”
- `interface` 是标准英文名，中文为“接口”
- `space` 仅作为旧 MCP / 兼容工具里的 `workspace` 别名
- `group` / `category` / `folder` 仅作为旧 MCP / YApi 兼容工具里的 `cat` 别名
- 新文档、新配置、新 Skill 说明必须统一使用 `workspace / project / cat / interface`

权限边界：
- workspace：只读
- project：只读
- cat：可 upsert
- interface：可 upsert
- 不允许 delete
- 不允许自动更新 interface
- 只有用户明确要求提交/更新接口文档时，才允许通过 ApiMind MCP 写入 cat/interface
- 当前阶段不考虑 CLI
- MCP Server 是 Codex / Claude / Gemini 等 AI Agent 的接入方式
- MCP Handler 后续应作为 transport adapter，复用后端 service/usecase，不直接操作数据库

重要设计原则：
1. 公共规则必须抽象到 ApiMind Skill，不要复制到每个项目的 AGENTS.md。
2. AGENTS.md 只保留当前仓库的极少量项目级上下文。
3. 项目差异应来自 `apimind-contract.yaml`、AGENTS.md 的极简说明、ApiMind MCP 查询结果或用户明确指定。
4. Skill 中不得写死具体 workspace_id、project_id、cat 映射。
5. 接口不会自动更新。只有用户明确要求写入时，才允许写 ApiMind。
6. project 下的接口分组 cat 的创建、更新、命名维护应由 `apimind-contract` 提供建议，并在用户确认后通过 MCP upsert；`apimind-project-config` 可以在用户提供或确认 workspace/project 时自动创建或更新本地工程的 `apimind-contract.yaml` 映射；本地可以维护轻量的 interface-to-cat 映射作为路由提示，但不应放在 AGENTS.md / CLAUDE.md。若无法确定 workspace/project/interface 归属，或多个 cat 候选都合理，必须说明不确定点并请求用户确认。
7. MCP tool 名称必须以实际 MCP Server 暴露的 tool schema 为准，不得臆造不存在的 tool。
8. 创建或更新 Skill/Plugin 时，必须优先使用 Codex 自带的 plugin-creator / skill-creator / writing-skills 等内置工作流；如果当前环境无法使用，应在输出中说明降级原因。
9. 本仓库中生成的 ApiMind Plugin 必须作为仓库文档资产提交到根目录 `docs/skills/` 下，不写入用户本机 `.codex/skills`、`.agents/skills` 或其他全局目录。
10. `apimind-project-config` 应支持 ApiMind Skill 工程项目配置与管理：在用户明确要求初始化、配置、绑定或管理 ApiMind Skill 项目配置时，可以创建或更新目标仓库的 `AGENTS.md`，并在需要兼容 Claude 时创建或更新 `CLAUDE.md`。
11. `docs/skills/apimind/` 后续会单独提交到 GitHub，作为可发布的 Codex Plugin 包；目录内容必须自包含、可独立拷出，不依赖当前仓库私有路径或本机全局配置。
12. Plugin 包必须兼容 Codex 和 Claude / Claude Code：Codex 使用 `AGENTS.md`，Claude 使用 `CLAUDE.md`，核心规则以各自 `SKILL.md` 为准。

请先分析当前仓库：
- 是否已有 AGENTS.md
- 是否已有 .codex / .agents / skills / docs 等相关目录
- 是否已有 `apimind-contract.yaml` 或类似项目映射配置
- 是否已有 MCP 相关说明
- 是否已有接口文档维护规则
- 是否已有 workspace/project/cat/interface 命名约定

如果仓库已有相关规范，请优先遵循；如果没有，请按下面规则创建。

一、工程项目配置与管理规则

`apimind-project-config` Skill 应包含目标仓库的 ApiMind Skill 工程项目配置与管理流程，而不是只给用户一段手工说明。

当用户明确要求“初始化 ApiMind Skill 配置”、“安装 ApiMind Skill 到当前仓库”、“配置当前仓库 ApiMind workspace/project”、“管理 ApiMind Skill 项目配置”或类似意图时，`apimind-project-config` 应能做两件事：

1. 创建或更新目标仓库的 `AGENTS.md`
2. 创建或更新目标仓库根目录的 `apimind-contract.yaml`，并要求用户提供 workspace/project 绑定关系

Claude 兼容：
- 如果用户明确使用 Claude / Claude Code，或仓库已有 `CLAUDE.md`，Skill 可以创建或更新 `CLAUDE.md`
- `CLAUDE.md` 与 `AGENTS.md` 使用同一套仓库级极简指引
- 仍然不要把公共 ApiMind 工作流复制进 `AGENTS.md` / `CLAUDE.md`

请在 Plugin 包内新增或更新：

docs/skills/apimind/README.md

README.md 应说明发布包本身不会自动改任意仓库；只有当已安装 Skill 在目标仓库中被用户明确要求配置或管理 ApiMind Skill 项目配置时，才会修改该目标仓库的 `AGENTS.md`、可选 `CLAUDE.md` 和 `apimind-contract.yaml`。

推荐 `AGENTS.md` / `CLAUDE.md` 项目配置内容如下，可根据目标仓库实际情况轻微调整：

- 当前仓库使用 ApiMind 管理接口文档
- ApiMind 层级为 workspace / project / cat / interface
- 中文命名为 工作区 / 项目 / 接口分组 / 接口
- 不允许因为代码变更自动更新 ApiMind
- 只有用户明确要求提交或更新接口文档时，才使用 ApiMind Contract Skill
- workspace/project 映射来自明确的 workspace/project 映射文件、ApiMind MCP 查询结果，或用户明确指定
- 运行配置文件例如 `apimind/etc/apimind.yaml` 不应被当作 workspace/project 映射文件，除非它明确包含这些映射字段
- 用户提供本仓库的 workspace/project 后，ApiMind Project Config Skill 可以更新本地根目录 `apimind-contract.yaml` 映射；这不是远端 ApiMind workspace/project 更新
- 不直接访问或修改数据库
- 不允许删除 ApiMind 资源
- 不考虑 CLI

推荐项目配置内容：

# AGENTS.md or CLAUDE.md

This repository uses ApiMind for API documentation.

ApiMind hierarchy:

workspace / project / cat / interface

Chinese labels:

工作区 / 项目 / 接口分组 / 接口

Do not automatically update ApiMind when code changes.

Only use the ApiMind Contract Skill when the user explicitly asks to submit, update, or sync API documentation to ApiMind.

Project mapping should be read only from an explicit workspace/project mapping file such as root `apimind-contract.yaml`, ApiMind MCP query results, or explicit user instructions.

Runtime config files such as `apimind/etc/apimind.yaml` are not ApiMind workspace/project mapping files unless they explicitly contain those mapping fields.

When the user provides the repository's ApiMind workspace/project, the ApiMind Project Config Skill may create or update the local root `apimind-contract.yaml` mapping. This is local repository configuration, not a remote ApiMind workspace/project update.

Do not directly access or modify the database.

Do not delete ApiMind resources.

二、ApiMind Plugin / Skills 规则

请创建或更新通用 ApiMind Plugin 发布包，一个 Codex Plugin 发布包内包含两个独立 Skills。

创建或更新 Plugin/Skill 前，必须优先启用或参考 Codex 自带的 Plugin/Skill 创建工作流，例如 `plugin-creator` / `skill-creator` / `writing-skills`。不要凭空手写一套与 Codex Plugin/Skill 规范冲突的目录结构。

Plugin 必须提交到根目录 `docs/skills/` 下，并按照标准 Codex Plugin 仓库目录组织。如果仓库没有已有约定，优先选择：

docs/skills/apimind/

该目录后续会作为独立 GitHub 仓库或发布包来源。请把 `docs/skills/apimind/` 当作发布包根目录来维护：
- 包内文件应自包含，后续可整体拷出或拆分到独立仓库
- 不引用当前机器的绝对路径
- 不依赖本仓库外部未提交文件
- 不把业务代码、MCP Server 实现或数据库访问逻辑放入 Plugin/Skill 包
- 如果需要详细参考资料，放在包内 `references/`，并从 `SKILL.md` 明确说明何时读取

推荐目录结构：

docs/skills/apimind/
├── .codex-plugin/
│   └── plugin.json
├── README.md
└── skills/
    ├── apimind-project-config/
    │   ├── SKILL.md
    │   └── agents/
    │       └── openai.yaml
    └── apimind-contract/
        ├── SKILL.md
        └── agents/
            └── openai.yaml

要求：
- `.codex-plugin/plugin.json` 必须存在，包含 `"skills": "./skills/"`
- 每个 Skill 的 `SKILL.md` 必须存在，包含 YAML frontmatter，至少包含 `name` 和 `description`
- 每个 Skill 的 `agents/openai.yaml` 如适用则生成，用于 Codex UI 元数据
- `README.md` 必须存在，说明 Plugin 包包含哪些 skills，以及 `apimind-project-config` 如何管理 Codex `AGENTS.md`、可选 Claude `CLAUDE.md` 与 `apimind-contract.yaml`
- `references/`、`scripts/`、`assets/` 只在确有需要时创建
- 不创建安装指南、变更日志等与 Skill 运行无关的附属文档；本任务中的 `README.md` 仅用于发布包说明和目标仓库项目配置说明
- 不把 Plugin/Skill 写入 `.codex/skills/`、`.agents/skills`、`.codex/plugins` 或其他用户本机全局目录
- 生成后应检查包边界，确认 `docs/skills/apimind/` 可作为独立 Codex Plugin 发布包提交到 GitHub

如果你选择了其他路径，请说明理由。

Skill 名称：

apimind-project-config
apimind-contract

Skill 目标：
- `apimind-project-config`：规范 Codex / Claude / Gemini 等 AI Agent 如何为目标仓库维护本地 ApiMind Skill 项目配置。
- `apimind-contract`：规范 Codex / Claude / Gemini 等 AI Agent 在用户明确要求提交/更新接口文档时，如何通过 ApiMind MCP 读取、搜索、创建或更新 cat/interface。

Skill 必须包含以下内容：

1. 默认只读

默认情况下，只允许读取 ApiMind 信息，例如：
- list workspaces
- get workspace
- list projects
- get project
- list cats
- get cat
- list interfaces
- get interface
- search interfaces

不要因为代码变更自动写入 ApiMind。

2. 明确写入触发条件

只有用户明确表达以下意图时，才允许写入 ApiMind：

允许触发写入的表达：
- 提交接口到 ApiMind
- 更新 ApiMind 接口
- 同步接口文档到 ApiMind
- 写入接口文档
- 创建或更新 cat
- 将当前接口分析结果提交给 ApiMind

不算明确写入的表达：
- 实现这个接口
- 修改这个接口代码
- 修复这个 bug
- 分析这个代码
- 生成测试
- 补充普通文档
- 重构 handler / DTO / route

如果用户没有明确要求写入 ApiMind，则只读分析，不写入。

3. 写入对象限制

允许：
- upsert cat
- upsert interface

禁止：
- create/update/delete workspace
- create/update/delete project
- delete cat
- delete interface
- bulk update many interfaces unless user explicitly asks for batch sync

说明：这里禁止的是通过 ApiMind MCP 修改远端 workspace/project。更新本地 `apimind-contract.yaml` 的 workspace/project 映射属于 `apimind-project-config` 的仓库配置维护，不属于远端 ApiMind 写入。

4. 写入前必须搜索

在创建或更新 cat/interface 前，必须：
- 先搜索已有 interface
- 再查找已有 cat
- 优先更新已有 interface
- 优先使用已有 cat
- 如果存在本地 interface-to-cat 映射，应先读取并用 MCP 校验远端 cat 是否存在
- 如果没有本地映射，应根据接口上下文自动推导目标 cat
- 如果 project 明确且推导出的 cat 明确，找不到合适 cat 时应先输出 cat 创建建议，用户确认后再 upsert cat
- cat 创建、更新、重命名维护需要用户确认；不能自动更新 interface
- 如果多个 cat 候选都合理，必须向用户说明候选项，不要猜测写入

4.1. project cat 创建与维护规则

项目接口分组 cat 可以在用户明确要求写入 ApiMind 时创建或更新，但必须先给出建议并获得用户确认，除非用户已经明确要求直接执行该 cat 创建/更新。

允许建议创建/更新 cat 的条件：
- workspace 和 project 已确认
- 目标 cat 来自接口上下文的清晰推导，例如接口 path 前缀、title、OpenAPI tag、route group、handler/module/service 名称、周边接口文档，或通过 MCP 查询到的清晰项目命名约定
- 当前 MCP schema 暴露了 project-scoped cat/group upsert 工具

禁止：
- 把 interface-to-cat 映射放进 AGENTS.md / CLAUDE.md
- 仅根据松散代码目录猜测 cat 名；必须结合接口语义和 MCP 查询结果
- 在多个 cat 候选项之间自行选择
- 因为 cat 可自动创建就自动写入或更新 interface
- 在 workspace/project 不明确时创建 cat

4.2. 本地 interface-to-cat 映射

本地可以维护轻量映射，用于把接口路由、OpenAPI tag、route group 或模块路径映射到 ApiMind cat。

映射推荐放在根目录 `apimind-contract.yaml` 或等价显式映射文件中，不放在 `AGENTS.md` / `CLAUDE.md`。

示例：

apimind:
  workspace: mydev
  project: apimind
  interface_cat_mapping:
    "/api/users/**": "User"
    "/api/projects/**": "Project"
    "internal/mcp/**": "MCP"

映射规则：
- 映射是路由提示，不是远端事实；写入前必须用 MCP 查询 project cats 校验
- cat 不删除、不新建、不改名时，本地映射通常不需要变更
- 新建或重命名 cat 后，Skill 可以建议更新本地映射，但只有用户明确要求修改本地文件时才写入
- 映射应保持宽粒度和稳定，不建议每个接口维护一条映射

4.3. 本地 workspace/project 映射维护

`apimind-project-config` 可以维护本地工程的 ApiMind 目标映射。推荐放在根目录 `apimind-contract.yaml` 或等价显式映射文件中。

最小配置：

apimind:
  workspace: mydev
  project: apimind

如果用户提供 id 或 MCP 能唯一解析，也可以保存 id：

apimind:
  workspace_id: 1
  workspace: mydev
  project_id: 11
  project: apimind

规则：
- 用户明确提供 workspace/project 时，可以自动创建或更新本地映射文件
- 已有映射文件时，应保留无关字段，只更新 ApiMind workspace/project 相关字段
- 缺少 id 时可以只保存名称；真正写入远端 cat/interface 前再通过 MCP 校验
- 如果 MCP 查询发现同名 workspace/project 不唯一，应请求用户确认后再保存 id
- 不要把 workspace/project 映射写进 AGENTS.md / CLAUDE.md
- 不要通过 MCP 创建或更新远端 workspace/project

5. 不确定时不写

如果无法确认以下任一内容：
- workspace
- project
- target cat derivation when multiple candidates are equally plausible
- interface
- method
- path
- schema
- 是否应新增或更新

则不要写入 interface。应输出不确定点并请求用户确认。若仅 cat_id 不存在，但 target cat 可以从接口上下文清晰推导，应先建议创建 cat 并等待用户确认，再 upsert cat 和写入 interface。

6. 写入必须带元数据

每次 upsert_cat / upsert_interface 必须尽量包含：

- source
- agent_provider
- change_reason
- change_summary

默认：
- source: ai_agent
- agent_provider: codex

如果实际执行者不是 Codex，应使用对应 agent provider，例如 claude / gemini / gpt。

如果 MCP schema 中字段名不同，请使用实际 schema 中的等价字段；如果缺少对应字段，请在输出中说明。

7. interface 文档内容规范

提交 HTTP interface 时，应尽量包含：

- workspace_id 或 workspace 标识
- project_id 或 project 标识
- cat_id 或 cat_name
- method
- path
- title
- description
- auth requirements
- request headers
- path params
- query params
- body schema
- response schema
- examples
- error codes
- source
- agent_provider
- change_reason
- change_summary

提交 WebSocket / 事件类 interface 时，应尽量包含：

- endpoint
- handshake headers
- message types
- envelope schema
- payload schema
- ack rules
- error rules
- response envelope
- examples

8. 写入前输出简短计划

在写入 ApiMind 前，除非用户明确要求直接执行，否则应先输出简短写入计划：

- target workspace/project
- target cat
- target interface
- create or update
- reason
- uncertainty

如果用户要求直接执行，可执行后再总结。

9. 写入后必须总结

每次写入后，应向用户汇总：

- 写入了哪个 workspace/project/cat/interface
- 是新增还是更新
- 主要变更点
- 是否存在不确定字段
- 是否建议人工复核

10. MCP tool 名称约束

本文档中的 tool 名称是概念性名称。实际调用时，必须以当前 MCP Server 暴露的 tool schema 为准。

不得调用不存在的 tool。

如果缺少必要 MCP tool，应说明缺口，不要伪造结果。

11. 术语命名约束

统一使用：

- `workspace` / 工作区
- `project` / 项目
- `cat` / 接口分组
- `interface` / 接口

兼容名只允许出现在 MCP schema 说明或旧 YApi 兼容说明中：

- `space` => `workspace`
- `group` / `category` / `folder` => `cat`

不要在新文档、AGENTS.md / CLAUDE.md 项目配置内容、`apimind-contract.yaml` 示例中使用 `space`、`group`、`category`、`folder` 作为标准层级名。

三、apimind-contract.yaml 规则

如果当前仓库已有 `apimind-contract.yaml` 或类似配置，请保留并遵循。

如果没有，目标仓库项目配置管理流程可以创建一个模板配置，并要求用户提供 workspace/project 绑定关系。用户提供 workspace/project 后，可以创建或更新为最小配置。该配置至少包含 workspace/project 映射：

apimind:
  workspace_id: "<workspace_id>"
  project_id: "<project_id>"

可选名称字段和接口分组映射：

apimind:
  workspace_id: "<workspace_id>"
  project_id: "<project_id>"
  workspace: "<workspace_name>"
  project: "<project_name>"
  interface_cat_mapping:
    "/api/users/**": "User"
    "/api/projects/**": "Project"

如果没有 `apimind-contract.yaml`，且无法通过 MCP 或用户指令确认 project 映射，不允许写入 ApiMind。

不要建议用户配置 `default_cat`。如果需要本地接口到 cat 的稳定映射，使用 `interface_cat_mapping`，并在写入前通过 MCP 校验远端 cat。

四、当前任务需要完成

请执行以下步骤：

1. 分析当前仓库文档与 Agent 配置现状
2. 在 Skill 中新增或完善工程项目配置与管理流程：创建或更新 `AGENTS.md`，按需创建或更新 `CLAUDE.md`
3. 创建或更新 ApiMind Contract Skill
4. Plugin 必须提交到根目录 `docs/skills/apimind/` 或仓库既有的 `docs/skills` 等价目录
5. Skill 创建或更新过程必须使用或参考 Codex 自带 Skill 创建工作流
6. 检查 `docs/skills/apimind/` 是否可作为独立 Codex Plugin 发布包根目录
7. 在 Plugin 包内新增或更新 `README.md`，说明项目配置管理会生成哪些目标仓库文件，以及何时要求用户提供 workspace/project 绑定
8. 不修改业务代码
9. 不实现 MCP Server
10. 不创建复杂版本系统
11. 不创建 CLI 相关内容
12. 输出变更文件列表
13. 输出最终 README 项目配置管理说明摘要
14. 输出最终 Skill 摘要
15. 输出后续建议：MCP tools 应如何与该 Skill 对齐

五、输出格式

请输出：

## Current Repo Findings
- 是否已有 AGENTS.md
- 是否已有 skills 目录
- 是否已有 `apimind-contract.yaml`
- 是否已有相关规则

## Files Changed
- 列出修改/新增文件路径
- 必须包含 `docs/skills/apimind/.codex-plugin/plugin.json`
- 必须包含 `docs/skills/apimind/skills/apimind-project-config/SKILL.md`
- 必须包含 `docs/skills/apimind/skills/apimind-contract/SKILL.md`
- 必须包含 `docs/skills/apimind/README.md`

## README Project Config Summary
- 说明 README 如何描述目标仓库 `AGENTS.md`、可选 `CLAUDE.md` 与 `apimind-contract.yaml` 的项目配置管理

## ApiMind Skill Summary
- 说明 Skill 中包含哪些通用规则
- 说明 Plugin 包是否可以独立拆出并提交到 GitHub 发布

## Follow-up Recommendations
- 推荐后续 MCP Server 至少需要哪些 tools
- 哪些 tool 应只读
- 哪些 tool 可写
- 哪些 tool 不应开放

六、再次强调

不要把公共规则复制进每个项目 AGENTS.md。

最终分层必须是：

README.md = 发布包说明 + 目标仓库项目配置管理说明
ApiMind Plugin = 一个发布包，包含 `apimind-project-config` 与 `apimind-contract` 两个独立 skills
apimind-project-config = AGENTS.md / CLAUDE.md / apimind-contract.yaml 项目配置管理流程
apimind-contract = 所有项目共用的接口文档维护流程
apimind-contract.yaml = 当前仓库的 workspace/project 映射
MCP = 实际读写 ApiMind 的工具
