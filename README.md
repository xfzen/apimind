# ApiMind

[English](README.en.md)

## 项目介绍

ApiMind 是一个自托管、API-first、兼容 YApi 的 API 平台，面向开发者与 AI Agent。Headless ApiMind Server 提供独立运行时，Web 提供浏览器体验，Skills 提供 Codex/MCP 集成。

本仓库是官方产品、源码集成、文档和发行入口：

```text
apimind/
├── web/       # 直接维护的 Apache-2.0 WebUI
├── skills/    # 直接维护的 Apache-2.0 Codex 插件
└── server/    # 固定公开提交的 BUSL-1.1 submodule
```

## 核心能力

- YApi 兼容的项目、接口与文档 HTTP API；
- HTTP Mock 与测试集合执行；
- MCP HTTP 契约集成；
- OpenAPI 3.0.3 契约；
- MongoDB 7.0.37 数据存储。

## 与 YApi 的关系与主要区别

ApiMind Web 基于 YApi Web 二次开发，延续项目、接口、Mock 和测试集合等主要交互习惯。ApiMind Server 不是原 YApi Node.js 后端的直接移植，而是独立实现的 Go 服务，通过 YApi 兼容接口支持 Web 和其他客户端。

这里的“兼容 YApi”主要指兼容 YApi Web 使用的协议与数据模型：

| 兼容层面 | ApiMind 的兼容方式 |
| --- | --- |
| HTTP API | 保留主要 `/api/*` 与 `/mock/*` 路径及其请求、响应约定 |
| 响应与认证 | 保留 `errcode`、`errmsg`、`data` 响应结构，以及 `_yapi_token`、`_yapi_uid` Cookie 约定 |
| MongoDB 数据 | 沿用主要集合、BSON 字段、数字 ID 与 `identitycounters`，支持既有 YApi 数据的延续与迁移 |
| Web 与 Mock | 支持当前 ApiMind Web 所需的项目、接口、文档、测试集合和 HTTP Mock 主链路 |

兼容不表示覆盖 YApi 的全部历史接口、任意 Node.js 第三方插件或所有部署配置，也不承诺任何 YApi 实例都可以无缝替换。具体支持范围以 Server 的[兼容路由清单](https://github.com/xfzen/apimind-server/blob/dev/api/compatibility/v1/routes.yaml)、[API 版本与兼容政策](https://github.com/xfzen/apimind-server/blob/dev/API-VERSIONING.md)和 [YApi API 完整性矩阵](https://github.com/xfzen/apimind-server/blob/dev/docs/audits/yapi-api-completeness-matrix.md)为准。

下表中的 YApi 指本仓库迁移记录所对应的 Web 基线，不代表对 YApi 后续所有版本的完整比较。

| 维度 | YApi 基线 | ApiMind |
| --- | --- | --- |
| 应用架构 | Web 与 Node.js 服务端在同一代码库中 | Web 是独立浏览器客户端；认证、存储和业务 API 由 Headless Go Server 提供 |
| 前端技术栈 | React 16、Ant Design 3、Webpack 2 | React 18、Ant Design 6、Vite 5，并保留必要的旧页面兼容层 |
| 文档体验 | 以接口文档和 Wiki 插件为主 | 增加项目与工作区文档工作台，支持文档树、目录、Markdown 编辑、预览和分屏 |
| 项目复用 | 以普通项目和接口模板配置为主 | 增加模板项目、模板文档和编辑流程 |
| 导入导出与插件 | 常用能力主要由运行时插件动态注入 | 常用导入导出能力内建，并通过显式注册表管理保留、迁移或禁用的插件 |
| 构建与部署 | 前端构建与历史 Node.js 服务端发布流程耦合 | Server 与 Web 在宿主机构建；Web 产物由 Nginx 运行镜像封装，Docker 内不编译源码 |
| 安全与质量 | 依赖和质量约束分散在历史构建链中 | 增加依赖安全、内容清理、仓库边界、构建输出、容器配置和 CI 门禁 |

详细修改、兼容边界与源码依据见 [ApiMind Web 相对 YApi Web 的修改与改进](web/docs/changes-from-yapi.md)，来源和许可证说明见 [`web/MODIFICATIONS.md`](web/MODIFICATIONS.md) 与 [`web/MIGRATION.md`](web/MIGRATION.md)。

## 组件

| 组件 | 作用 | 许可证 |
| --- | --- | --- |
| [`server/`](server/) | 独立版本化的 Headless/API-first Runtime Core | BUSL-1.1 源码可用 + 商业许可 |
| [`web/`](web/) | YApi 兼容浏览器体验 | Apache-2.0 |
| [`skills/`](skills/) | Codex/MCP 项目配置与契约维护 | Apache-2.0 |

## Quick Start

环境要求：Go 1.25.12、Node.js 22、npm 10+ 和 Docker。所有下载使用官方发布源。

```bash
git clone --recurse-submodules https://github.com/xfzen/apimind.git
cd apimind
cp .env.example .env
make dev
```

Server 和 Web 均在宿主机编译，Docker 只负责运行 MongoDB 和打包运行时镜像。打开 `http://127.0.0.1:4000`，完成注册或登录，并创建最小工作区、项目和接口。Server 开发端口是 `127.0.0.1:18889`。

`cp .env.example .env` 后，本地 Compose 会预置开发账号
`admin@example.invalid`，初始密码为 `change-me-local-only`。这些值来自本地
`.env`，仅用于开发；启动前应修改，且不要提交 `.env`。也可以直接注册新账号。

完整步骤见[中文 Quick Start](docs/quick-start.md)。

## 文档列表

从[中文文档索引](docs/README.md)进入快速开始、架构、组件、兼容性、能力矩阵、生态与 Roadmap；英文读者参见 [Documentation](docs/README.en.md)。

## Roadmap

Roadmap 只表达方向，不承诺发布日期。详见 [Roadmap](docs/roadmap.md)。

## 社区与安全

贡献说明见 [CONTRIBUTING.md](CONTRIBUTING.md)，安全问题见 [SECURITY.md](SECURITY.md)。

## 许可证

根目录、Web 和 Skills 使用 Apache-2.0。Server submodule 不受根许可证覆盖，采用 BUSL-1.1 源码可用许可证并提供商业授权。详见 [`LICENSING.md`](LICENSING.md)。
