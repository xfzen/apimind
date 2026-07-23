# ApiMind Web

[English](README.en.md)

## 项目介绍

ApiMind Web 是 ApiMind 的独立浏览器客户端，基于 YApi Web 演进而来。它提供接口管理、文档、Mock、测试集合与项目协作等浏览器交互，并由 ApiMind Go 服务负责认证、数据存储和业务 API。

## 在 ApiMind 中的角色

Web 只负责浏览器体验。浏览器代码不直接访问远端 ApiMind、YApi 或业务 API：开发环境由 Vite 将同源请求代理到 Go 服务，生产环境使用站点同源入口或构建时配置的 Go 服务入口。

## 当前能力

- YApi 兼容的工作区、项目、接口与文档界面；
- HTTP Mock 与测试集合交互；
- 通过 Go 服务完成登录、注册和业务数据访问；
- 独立的宿主机构建与静态站点运行配置。

具体行为以当前 Web 源码和 Server 契约为准。

## 主要修改与改进

ApiMind Web 保留 YApi Web 的核心交互模型，同时围绕独立部署、现代前端、安全和产品能力进行了持续改造。

| 维度 | YApi 基线 | ApiMind Web |
| --- | --- | --- |
| 应用架构 | 浏览器前端与历史 Node.js 服务端位于同一仓库 | 独立浏览器客户端；认证、存储和业务 API 由 ApiMind Go Server 提供，浏览器只使用同源请求或本地开发代理 |
| 前端技术栈 | React 16、Ant Design 3、Webpack 2 和旧式模块兼容层 | React 18、Ant Design 6、Vite 5，并补充 ESM、图标、表单、样式和 CommonJS 互操作适配 |
| 文档体验 | 以接口文档展示和 Wiki 插件为主 | 增加项目与工作区文档工作台，支持文档树、目录、预览、编辑、分屏、标题定位和双向滚动同步 |
| 项目复用 | 以普通项目和接口模板配置为主 | 增加模板项目入口、导航、模板文档和编辑流程，为标准化项目初始化提供基础 |
| 导入导出与插件 | 常用能力依赖运行时插件动态注入 | 将 Postman、HAR、Swagger、YApi JSON 导入、数据导出和 Gen Services 设置内建，并用显式注册表管理保留或禁用的插件 |
| 安全 | 存在较多停止维护的历史依赖，安全约束分散 | 升级安全敏感依赖，引入防原型污染的 Mock.js、内容清理、输入校验、官方 npm 下载约束和自动化安全基线 |
| 构建与部署 | 构建链与历史服务端耦合，生产资源长期保存在 `static/prd/` | 宿主机使用 Vite 生成被 Git 忽略的 `dist/`；Nginx 运行镜像只封装现有产物，不在 Docker 中编译 Web |
| 工程质量 | 以历史单元测试和构建流程为主 | 增加文档、仓库边界、依赖安全、编辑器契约、构建输出、容器配置和当前快照 CI 门禁 |

逐项说明、实际影响、兼容边界和源码依据见[详细修改与改进](docs/changes-from-yapi.md)。来源、许可证边界和迁移记录见 [MODIFICATIONS.md](MODIFICATIONS.md)、[MIGRATION.md](MIGRATION.md) 与 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

## 环境要求

- Node.js 22；
- npm 10 或更高版本；
- 运行在 `127.0.0.1:8888` 的 ApiMind Go 服务。

## Quick Start

先按照 [ApiMind Server 文档](https://github.com/xfzen/apimind-server)启动本地 Go 服务，再运行：

```bash
npm ci --registry=https://registry.npmjs.org
YAPI_API_TARGET=http://127.0.0.1:8888 npm run dev
```

浏览器访问 `http://127.0.0.1:4000`。`YAPI_API_TARGET` 只配置 Vite 开发代理；浏览器仍请求站点自身的 `/api`、`/mock` 等路径。

## 配置

- `YAPI_API_TARGET`：开发服务器代理目标，默认 `http://127.0.0.1:8888`；
- `YAPI_API_BASE`：宿主机执行生产构建时注入的 Go 服务入口，留空表示同源；
- `dist/`：被 Git 忽略的生产构建输出。

## 文档列表

从[中文文档索引](docs/README.md)进入开发、迁移、安全、许可和历史资料；英文读者参见 [Documentation](docs/README.en.md)。

## 开发与验证

```bash
npm run lint
npm test
npm run smoke:schema-editor
YAPI_API_BASE= npm run build
```

所有前端编译都在宿主机或 CI 完成。Dockerfile 只封装已经生成的 `dist/`，不编译 Web。

如需运行容器镜像，必须先完成上面的宿主机构建，再仅打包已有的 `dist/`：

```bash
docker build -t apimind-web .
docker run --rm -p 8080:8080 apimind-web
```

## 安全

请阅读 [SECURITY.md](SECURITY.md)。不要把凭据、远端业务地址或绕过 Go 服务的直连逻辑放入浏览器代码。

## 许可证

ApiMind Web 按 [Apache-2.0](LICENSE) 提供。项目源自 [YMFE/YApi](https://github.com/YMFE/yapi)，原始版权、第三方组件和 ApiMind 修改说明见 [NOTICE](NOTICE)、[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) 与 [MODIFICATIONS.md](MODIFICATIONS.md)。本项目由 ApiMind 独立维护，与 YMFE 或 YApi 官方不存在隶属、赞助或认可关系。
