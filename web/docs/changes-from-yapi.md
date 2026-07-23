# ApiMind Web 相对 YApi Web 的详细修改与改进

ApiMind Web 基于 YApi Web 演进，保留项目、接口、Mock、测试集合等主要交互习惯，同时将浏览器端改造成可独立构建、独立部署并由 ApiMind Go Server 提供业务能力的 Web 客户端。

本文展开说明根 [README](../README.md) 中的对比表。它关注当前代码快照中的产品与工程变化，不是提交历史清单，也不替代 Server API 契约、许可证或迁移记录。

## 范围与权威说明

| 主题 | 说明 |
| --- | --- |
| 当前行为依据 | 以 Web 源码、构建配置和 ApiMind Server 契约为准 |
| YApi 基线 | 指 [MIGRATION.md](../MIGRATION.md) 记录的来源快照及仓库保留的 YApi 交互模型，不代表对 YApi 所有版本的完整评测 |
| 分析范围 | 只描述当前文件能够证明的变化，不扫描或复述 Git 历史 |
| Web 职责 | 只负责浏览器体验；认证、数据存储、Mock 执行和业务 API 由 Go 服务负责 |
| 排除范围 | 不涉及桌面端、Server 内部实现和 PostgreSQL 规划 |

## 修改一览

| 维度 | 主要变化 | 直接影响 |
| --- | --- | --- |
| 应用架构 | 从前后端同仓转为独立浏览器客户端，并连接 Go 服务 | Web 可以独立开发和部署，服务端职责更清晰 |
| 前端技术栈 | 升级到 React 18、Ant Design 6 和 Vite 5 | 获得当前维护的开发基础，同时保留必要兼容层 |
| 文档体验 | 增加项目与工作区文档工作台 | 文档浏览、编辑、目录定位和分屏预览集中在同一界面 |
| 项目复用 | 增加模板项目、模板文档和编辑流程 | 团队可以复用项目结构与规范内容 |
| 导入导出与插件 | 将常用数据能力内建，并显式管理插件状态 | 常用能力不再依赖运行时动态发现，支持边界更明确 |
| 安全 | 更新敏感依赖并增加内容清理、输入校验和供应链约束 | 降低历史依赖、非可信内容和非官方下载源风险 |
| 构建与部署 | 产物统一输出到 `dist/`，容器只封装现有产物 | 构建过程可重复，Docker 运行镜像不承担前端编译 |
| 工程质量 | 增加文档、边界、安全、构建和容器门禁 | 仓库拆分后的关键约束可以持续自动验证 |

## 1. 应用架构

| 对比项 | 详细说明 |
| --- | --- |
| YApi 基线 | 浏览器前端与 Node.js 服务端位于同一仓库，前端构建、服务端入口、生产静态资源和插件服务端逻辑相互关联。 |
| ApiMind Web 改造 | 当前仓库只保留浏览器应用。历史 Node.js 服务端入口和目录不属于当前运行时；登录、存储和业务 API 由 ApiMind Go Server 提供；浏览器继续请求 `/api`、`/mock` 等业务路径；开发环境由 Vite 使用 `YAPI_API_TARGET` 代理到本地 Go 服务；生产环境使用站点同源入口，或在宿主机构建时通过 `YAPI_API_BASE` 指定服务入口；浏览器代码不得直接依赖相邻仓库，也不得绕过 Go 服务直连远端业务 API。 |
| 实际影响 | Web 与 Server 可以分别维护、构建和发布；浏览器端不再承担数据持久化、鉴权实现或业务服务编排；本地开发继续使用同源业务路径，不需要在各页面散布后端地址；仓库边界检查可以阻止重新引入历史 Node 服务或跨组件源码依赖。 |
| 兼容性与注意事项 | 独立部署不等于浏览器协议被完全重写。现有页面仍使用 YApi 风格的 `/api` 和 `/mock` 路径，实际可用行为取决于 ApiMind Server 的兼容契约。跨域部署还必须由服务端正确配置 Cookie 和 CORS；默认推荐同源部署或使用本地开发代理。 |
| 当前实现依据 | [HISTORICAL_CODE.md](../HISTORICAL_CODE.md)<br>[MIGRATION.md](../MIGRATION.md)<br>[`client/utils/request.js`](../client/utils/request.js)<br>[`client/utils/backend.js`](../client/utils/backend.js)<br>[`vite.config.mjs`](../vite.config.mjs)<br>[`scripts/check-repository-boundary.mjs`](../scripts/check-repository-boundary.mjs)<br>[`tests/migration/current-snapshot.test.mjs`](../tests/migration/current-snapshot.test.mjs) |

## 2. 前端技术栈

| 对比项 | 详细说明 |
| --- | --- |
| YApi 基线 | 来源项目使用 React 16、Ant Design 3、Webpack 2 及旧式 Babel、CommonJS 和动态插件兼容方式。部分页面和扩展依赖旧组件 API、装饰器语法和默认导出行为。 |
| ApiMind Web 改造 | 开发基础升级为 React 18、React DOM 18、Ant Design 6、独立图标包和 Vite 5；同时引入 React Redux 8、Redux 4 及当前维护的编辑器和 Schema 依赖。Vite 集中处理装饰器、类属性、JSX、旧模块默认导出和特定插件源码转换，并保留 React Root、Ant Design 图标、Locale、Collapse、编辑器和 CommonJS 互操作适配。 |
| 实际影响 | 开发启动和生产构建使用统一的 Vite 配置；新代码可以使用当前 React 与编辑器生态；旧页面不需要一次性全部重写，迁移可以围绕明确兼容层逐步进行；技术栈升级与业务功能迁移相互分离。 |
| 兼容性与注意事项 | 仓库仍保留部分历史依赖和旧式页面结构，它们是兼容现有交互的过渡基础，不表示所有代码已经转换为现代函数组件或 TypeScript。兼容层不能随意删除，删除前必须验证相关页面、编辑器和插件入口。 |
| 当前实现依据 | [`package.json`](../package.json)<br>[`vite.config.mjs`](../vite.config.mjs)<br>[`client/shims/`](../client/shims/)<br>[`client/Application.js`](../client/Application.js)<br>[`tests/build-output.test.mjs`](../tests/build-output.test.mjs) |

## 3. 文档体验

| 对比项 | 详细说明 |
| --- | --- |
| YApi 基线 | 主要文档体验围绕接口详情和 Wiki 插件展开。接口说明、公共信息和 Wiki 能力存在，但没有当前 ApiMind 文档工作台中的统一编辑与导航体验。 |
| ApiMind Web 改造 | 增加项目与工作区文档工作台，覆盖文档读取、创建、更新、移动和删除；支持工作区文档到承载项目的解析、文档树、Markdown 原文编辑与安全预览；提供预览、编辑和分屏三种模式；支持标题提取、目录定位、活动标题同步、编辑区与预览区双向滚动同步，以及保存状态和编辑权限控制。 |
| 实际影响 | API 说明、项目约定和工作区级文档可以在统一界面内浏览和维护。长文档可通过标题目录快速定位，编辑时可以同时查看 Markdown 原文与渲染结果，减少在外部文档工具与接口平台之间切换。 |
| 兼容性与注意事项 | Wiki 插件仍保留兼容入口，但新的文档工作台是独立能力。文档数据、权限和工作区映射依赖 Go 服务对应接口；历史 `docs/documents/` 下的 YApi 文档只是来源资料，不是当前功能的权威说明。 |
| 当前实现依据 | [`client/components/Docs/`](../client/components/Docs/)<br>[`client/containers/Project/Interface/Docs/DocsInterface.js`](../client/containers/Project/Interface/Docs/DocsInterface.js)<br>[`client/reducer/modules/docs.js`](../client/reducer/modules/docs.js)<br>[`client/components/Docs/MarkdownPreview.tsx`](../client/components/Docs/MarkdownPreview.tsx)<br>[Markdown 编辑器设计](history/2026-05-27-docs-workspace-raw-markdown-editor-design.md) |

## 4. 项目复用

| 对比项 | 详细说明 |
| --- | --- |
| YApi 基线 | 提供普通项目与接口模板等配置能力，但项目初始化、规范文档和团队约定主要由各项目分别维护。 |
| ApiMind Web 改造 | 增加模板项目列表入口以及模板项目与普通项目的类型区分；支持按分类展示模板文档、模板搜索与选择、模板内容查看和 Markdown 编辑；可维护模板标题、描述、分类、键值和变更信息，并调用对应的模板项目、列表、搜索、读取和更新接口。 |
| 实际影响 | 团队可以集中维护常用结构、规范说明和模板内容，为后续项目初始化和标准化协作提供可复用基础。模板不再只是单个接口字段配置，而是可以承载分类化文档内容的项目形态。 |
| 兼容性与注意事项 | 模板能力依赖 Go 服务提供 `/api/templates/*` 契约。当前 Web 展示和编辑模板，但模板如何创建、授权或应用到新项目，应以 Server 契约和实际页面行为为准。 |
| 当前实现依据 | [`client/Application.js`](../client/Application.js)<br>[`client/containers/Templates/`](../client/containers/Templates/)<br>[`client/containers/Project/TemplateProject/`](../client/containers/Project/TemplateProject/)<br>[`client/reducer/modules/template.js`](../client/reducer/modules/template.js)<br>[`client/containers/Project/Project.js`](../client/containers/Project/Project.js) |

## 5. 导入导出与插件

| 对比项 | 详细说明 |
| --- | --- |
| YApi 基线 | Postman、HAR、Swagger、数据导出、Wiki、Advanced Mock 等能力大量通过动态插件 Hook 注入。功能是否可见通常取决于运行时插件配置以及对应服务端插件是否安装。 |
| ApiMind Web 改造 | 使用显式注册表管理三类状态：<br>**保留运行时兼容入口：**Advanced Mock、Wiki。<br>**迁移为 Web 内建能力：**Postman、HAR、Swagger、YApi JSON 导入；HTML、Markdown、JSON、Swagger 2.0 导出；Gen Services 设置页。<br>**明确禁用：**Statistics、Swagger Auto Sync。<br>构建前根据显式注册表生成客户端插件模块，避免依赖隐式插件发现。 |
| 实际影响 | 常用导入导出入口随 Web 一起提供；已保留、已迁移和已禁用的能力边界可以直接审查；缺少 Go 服务支持的插件不会仅因为前端代码仍存在就被错误暴露；插件迁移可以逐项进行，无需维持完整的历史 Node 插件运行时。 |
| 兼容性与注意事项 | “内建”指前端入口和转换逻辑已纳入 Web，不表示所有数据处理都在浏览器内完成。导出、Gen Services、Wiki 和 Advanced Mock 等能力仍可能调用 Go 服务接口。`exts/` 中存在历史插件文件也不等于插件已启用，应以显式插件注册表为准。 |
| 当前实现依据 | [`client/builtins/pluginRegistry.js`](../client/builtins/pluginRegistry.js)<br>[`scripts/generate-plugin-module.js`](../scripts/generate-plugin-module.js)<br>[`client/containers/Project/Setting/ProjectData/importers.js`](../client/containers/Project/Setting/ProjectData/importers.js)<br>[`client/containers/Project/Setting/ProjectData/exporters.js`](../client/containers/Project/Setting/ProjectData/exporters.js)<br>[`client/containers/Project/Setting/settingTabs.js`](../client/containers/Project/Setting/settingTabs.js)<br>[`exts/`](../exts/) |

### 插件状态明细

| 能力 | 当前状态 | 说明 |
| --- | --- | --- |
| Advanced Mock | 保留运行时入口 | 继续通过插件 Hook 提供兼容入口，完整行为依赖 Go 服务 |
| Wiki | 保留运行时入口 | 继续提供项目 Wiki 兼容入口 |
| Postman / HAR / Swagger / YApi JSON 导入 | 已迁移为内建前端能力 | 由项目数据设置页直接注册和调用 |
| HTML / Markdown / JSON / Swagger 2.0 导出 | 已迁移为内建前端能力 | 前端直接提供导出入口，内容由对应 API 生成 |
| Gen Services | 已迁移为内建设置页 | 直接注册到项目设置导航 |
| Statistics | 禁用 | Go 侧统计路由和 Mock 指标持久化尚未实现 |
| Swagger Auto Sync | 禁用 | Go 侧安全抓取、调度、持久化和同步日志尚未实现 |

## 6. 安全

| 对比项 | 详细说明 |
| --- | --- |
| YApi 基线 | 来源代码包含多项停止维护或存在已知风险的历史依赖，HTML 输出、Mock 数据、输入校验和依赖下载来源的安全约束分散在不同模块中。 |
| ApiMind Web 改造 | 升级 Axios、加密、Schema、Markdown、查询字符串和 Swagger 等安全敏感依赖；固定仍在依赖图中的高风险传递依赖；使用仓库内经过保护的 `@apimind/mockjs-safe`；使用 DOMPurify 清理需要插入的 HTML；Markdown 预览使用 `rehype-sanitize` 和显式 Schema；保留集中式输入校验入口；只允许从 npm 官方源下载包；CI 固定外部 Action 并扫描当前快照；自动测试阻止已移除的高风险包重新进入依赖图。 |
| 实际影响 | 安全约束从一次性依赖升级转为可重复执行的基线。后续修改依赖、Markdown 渲染、Mock 引擎或下载源时，测试能够发现对既定安全边界的破坏。 |
| 兼容性与注意事项 | 内容清理可能移除不在允许列表中的 HTML 属性或标签，这是安全边界而不是渲染缺陷。安全测试只证明已编码的基线成立，不能替代依赖公告跟踪、服务端鉴权、部署配置和发布前安全评审。 |
| 当前实现依据 | [SECURITY.md](../SECURITY.md)<br>[`common/sanitize.js`](../common/sanitize.js)<br>[`client/components/Docs/MarkdownPreview.tsx`](../client/components/Docs/MarkdownPreview.tsx)<br>[`vendor/mockjs-safe/`](../vendor/mockjs-safe/)<br>[`scripts/vendor-mockjs-safe.mjs`](../scripts/vendor-mockjs-safe.mjs)<br>[`tests/security-baseline.test.mjs`](../tests/security-baseline.test.mjs)<br>[`tests/ci-policy.test.mjs`](../tests/ci-policy.test.mjs)<br>[`.npmrc`](../.npmrc) |

## 7. 构建与部署

| 对比项 | 详细说明 |
| --- | --- |
| YApi 基线 | 历史构建链与 Node.js 服务端发布流程耦合，生产资源放在仓库内的 `static/prd/`，前端产物与服务端运行目录共同维护。 |
| ApiMind Web 改造 | 构建和运行分为两个阶段：先在宿主机或 CI 使用 Vite 编译，再将 `dist/` 封装到只包含 Nginx 的运行镜像。`dist/` 被 Git 忽略；仓库不跟踪 `static/prd/` 生产产物；Dockerfile 只复制 Nginx 配置和已有 `dist/`；运行镜像不安装 Node.js、npm 或历史服务端；Nginx 在非特权端口 `8080` 提供静态站点并支持单页应用回退。 |
| 实际影响 | 同一个经过验证的 `dist/` 可以被明确封装和部署；前端依赖安装与容器运行环境分离；Docker 构建不会隐式访问 npm 或改变前端产物；构建失败和运行配置失败可以分别诊断。 |
| 兼容性与注意事项 | 必须先在宿主机或 CI 完成 `npm run build`，再执行 Docker 镜像封装。Dockerfile 不会代替前端构建。开发服务器默认使用 `4000` 端口，Nginx 运行镜像使用 `8080`，二者不是同一运行模式。 |
| 当前实现依据 | [`vite.config.mjs`](../vite.config.mjs)<br>[`.gitignore`](../.gitignore)<br>[`Dockerfile`](../Dockerfile)<br>[`deploy/nginx.conf`](../deploy/nginx.conf)<br>[`tests/build-output.test.mjs`](../tests/build-output.test.mjs)<br>[`tests/container-config.test.mjs`](../tests/container-config.test.mjs)<br>[`scripts/smoke/container-smoke.sh`](../scripts/smoke/container-smoke.sh) |

## 8. 工程质量

| 对比项 | 详细说明 |
| --- | --- |
| YApi 基线 | 来源项目已有单元测试和构建流程，但不覆盖 ApiMind 仓库拆分、Go 服务边界、现代构建产物、安全依赖和纯运行容器等新增约束。 |
| ApiMind Web 改造 | 增加独立 Web 组件门禁：<br>**仓库边界：**禁止相邻组件源码依赖、历史 Node 服务目录和浏览器远端直连配置。<br>**迁移快照：**确认当前树不包含 Node 服务入口并保留许可证与迁移记录。<br>**依赖安全：**检查最低版本、传递依赖覆盖、官方下载源和安全 Mock.js。<br>**构建输出：**验证 Vite 入口、`dist/` 隔离、环境变量边界和 CommonJS 兼容配置。<br>**容器配置：**验证 Nginx-only 镜像、端口、SPA 回退和宿主机构建要求。<br>**编辑器契约：**验证 Schema 与 Markdown 编辑器关键模块。<br>**公开文档：**检查中英文入口、共享事实、链接、禁止词和公开表面。<br>**CI 策略：**固定外部 Action、禁止发布动作并只扫描当前跟踪快照。 |
| 实际影响 | 仓库边界和发布约束不再只依赖维护者记忆。每次依赖升级、构建配置调整、文档更新或容器修改都可以复用相同检查，降低重新引入跨仓耦合、过期产物和不安全下载源的风险。 |
| 兼容性与注意事项 | 不同测试覆盖不同边界：文档校验通过不代表生产构建通过，单元测试通过也不代表 Go 服务契约完整。发布前仍应根据修改范围组合运行 lint、单元测试、Smoke、生产构建和容器验证。 |
| 当前实现依据 | [`.github/workflows/verify.yml`](../.github/workflows/verify.yml)<br>[`scripts/verify.sh`](../scripts/verify.sh)<br>[`scripts/verify-docs.mjs`](../scripts/verify-docs.mjs)<br>[`scripts/check-repository-boundary.mjs`](../scripts/check-repository-boundary.mjs)<br>[`tests/`](../tests/)<br>[`scripts/smoke/`](../scripts/smoke/) |

## 保留的兼容能力

| 能力领域 | 当前状态 | 说明 |
| --- | --- | --- |
| 工作区、项目、接口分组与接口管理 | 保留主要交互 | 延续 YApi 的主要信息组织与操作习惯 |
| 接口详情与 Schema | 保留并适配 | 支持请求参数、响应结构和 Schema 编辑 |
| HTTP Mock | 保留 | Mock 请求仍通过 Go 服务提供的兼容路径执行 |
| Advanced Mock | 保留兼容入口 | 是否完整可用取决于 Go 服务对应能力 |
| 测试集合与请求调试 | 保留 | 延续类 Postman 的接口调试体验 |
| 数据导入 | 内建 | 支持 YApi JSON、Postman、HAR 和 Swagger |
| Wiki | 保留兼容入口 | 与新的文档工作台并存 |
| 插件 Hook | 部分保留 | 仅显式注册的运行时插件生效 |
| 来源许可义务 | 持续保留 | 继续遵守 Apache-2.0、NOTICE 和第三方声明要求 |

兼容入口是否可以完整运行，取决于 ApiMind Server 是否提供相应 API。当前支持状态应以 Web 显式插件注册表、Go 服务契约和实际验证结果为准。

## 明确不包含的内容

| 不包含的内容 | 说明 |
| --- | --- |
| 历史 Node.js 服务端 | 不恢复、不构建，也不作为当前运行时维护 |
| 浏览器远端直连 | Web 不直接访问远端 ApiMind、YApi 或业务 API |
| Docker 内编译 | Dockerfile 不安装依赖，也不编译 Web |
| 自动启用历史插件 | `exts/` 中存在源码不代表插件已启用 |
| 桌面端行为 | 不描述打包、嵌入服务或桌面运行时 |
| PostgreSQL 当前能力 | PostgreSQL 是规划目标，不描述为当前存储实现 |
| 私有历史与远端推断 | 不推断私有历史、远端分支数量或未发布状态 |

## 相关文档

| 文档 | 用途 |
| --- | --- |
| [项目 README](../README.md) | 项目概览、Quick Start 和简要对比 |
| [ApiMind 修改摘要](../MODIFICATIONS.md) | 英文修改与来源摘要 |
| [Web 仓库迁移记录](../MIGRATION.md) | 来源基线、快照边界和许可说明 |
| [历史代码边界](../HISTORICAL_CODE.md) | 历史 Node 服务与当前 Web 的边界 |
| [安全策略](../SECURITY.md) | 安全问题报告和支持边界 |
| [第三方声明](../THIRD_PARTY_NOTICES.md) | 第三方来源与许可证信息 |
| [中文文档索引](README.md) | 当前文档入口 |
