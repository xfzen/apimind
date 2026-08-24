# ECP Requirements & Technical Design

**状态：** 已确认

**G0 实施证据：** [`docs/test-reports/ecp-g0-acceptance.md`](../../test-reports/ecp-g0-acceptance.md)；门槛场景已通过，明确的维护性后续不扩大为 G0 能力声明。

**日期：** 2026-08-23

**范围：** 面向 ApiMind、GPTS、AG Insight、NexTerm 等产品共享的 Enterprise Control Plane（ECP）需求与技术方案；不包含实施排期、任务拆分和代码变更计划

## 1. 决策摘要

企业采用一个产品，首先要求它能够被部署、控制、追责、恢复和安全退出。统一登录只是其中一项条件，不能代替产品授权、审计、数据治理和企业运维。

本 Spec 决定建设一套共享的 Enterprise Control Plane（ECP），而不是为每个产品分别开发企业后台。`ECP` 是系统和仓库缩写，运行组件固定命名为 `ecp-api`、`ecp-ui` 和 `ecp-connector`：

```text
Casdoor
   │
ecp-api
   │
ecp-ui
   │
   ├── ApiMind Connector
   ├── GPTS Connector
   ├── AG Insight Connector
   └── NexTerm Connector
```

核心决策如下：

1. `ecp-api` 是独立的 go-zero + GORM REST 服务，不嵌入任何产品主服务，G0 不额外拆分 RPC 服务；
2. `ecp-ui` 是基于 React、Ant Design、Tailwind CSS 和 Vite 的独立 TypeScript SPA，所有产品共同使用同一套代码和部署；
3. Casdoor 直接承担组织、用户、认证、上游 IdP、SSO、MFA、OAuth Client 及优先采用的 Casbin 授权引擎；
4. `ecp-api` 不重复实现密码、MFA、LDAP、SAML、OIDC Provider 或通用 IAM；
5. `ecp-api` 负责产品注册、身份映射、产品会话、产品权限语义、策略编排、服务身份、统一审计、兼容投影和企业安全配置；
6. 每个产品只实现一个轻量 `ecp-connector`，并继续独占自己的业务数据库；
7. 每个企业首期部署一套 ECP，可同时连接多个产品和产品实例；
8. 数据模型预留内部 `enterprise_id`，但首期不开放多企业 SaaS 管理能力；
9. Casdoor、`ecp-api` 和各产品使用独立 database、独立账号、独立迁移和独立备份；
10. 即使未来全部使用 PostgreSQL 或 MySQL，也不得合库、共享表或建立跨库外键；
11. ECP 从第一天按可独立仓库交付：服务端、管理端和 Connector SDK 不得依赖 ApiMind 私有包；当前放在 ApiMind 仓库只是一种集成期工作区布局，后续拆仓不改变 Go module/import path 或 HTTP 契约。

## 2. 第一性原理与企业门槛

企业生产采用必须同时回答五类问题：

```text
能部署 → 能控制 → 能追责 → 能恢复 → 能退出
```

对应的 G0 能力为：

| 门槛 | 必要能力 |
| --- | --- |
| 能部署 | 私有部署、受控外部依赖、配置校验、升级兼容 |
| 能控制 | 企业身份、产品 RBAC、机器身份、数据暴露策略 |
| 能追责 | 身份、权限、凭据及关键业务操作的追加式审计 |
| 能恢复 | 多数据域备份、恢复、校验和升级失败处理 |
| 能退出 | 完整导出、账号停用、凭据撤销和数据保留策略 |

Casdoor 主要解决“谁可以完成认证”以及通用策略执行；产品资源含义、企业交付和业务追责仍属于 ECP 与产品 `ecp-connector` 的职责。

## 3. 目标与非目标

### 3.1 目标

- 一个企业只建设和运维一套企业控制台；
- 企业身份、用户组、安全策略和审计入口可以跨产品复用；
- 产品权限、资源和数据严格隔离，不因共用身份而自动共享访问权；
- 新产品可以通过稳定 Connector 契约接入，而不复制用户、权限和后台代码；
- 中小团队可以使用最小部署组合，企业可以按需接入外部 IdP 和条件性能力；
- ECP 故障、产品故障和身份系统故障具有清晰、默认安全的边界；
- PostgreSQL 和 MySQL 都可作为 `ecp-api` 与 Casdoor 的关系数据库，但一个实例只选用一种。

### 3.2 非目标

- 不建设 HR、部门和完整组织树；
- 不建设任意策略 DSL 或通用低代码权限平台；
- 不建设跨产品业务流程和跨产品资源关系；
- 不把产品业务数据集中到控制数据库；
- 不让 `ecp-ui` 成为各产品业务后台的替代品；
- 不在首期建设多企业 SaaS 计费、租户运营和企业切换；
- 不在首期建设微前端或任意 `ecp-ui` 插件市场；
- 不直接读取或修改 Casdoor 和产品数据库。

## 4. 系统上下文

```text
                         ┌──────────────────────┐
                         │       Casdoor        │
                         │ Organization / User  │
                         │ OIDC / MFA / Casbin  │
                         └──────────┬───────────┘
                                    │ OIDC / Official API
┌──────────────┐          ┌─────────▼───────────┐
│ ecp-ui       │ HTTPS    │ ecp-api            │
│              ├─────────►│                    │
└──────────────┘          └─────────┬───────────┘
                                    │ Connector Contract
                ┌───────────────────┼───────────────────┐
                │                   │                   │
         ┌──────▼──────┐     ┌──────▼──────┐     ┌──────▼──────┐
         │ ApiMind     │     │ GPTS        │     │ Other       │
         │ Connector   │     │ Connector   │     │ Connectors  │
         └─────────────┘     └─────────────┘     └─────────────┘
```

ECP 建议使用独立统一域名，例如 `https://enterprise.example.com`。产品中的企业管理入口只跳转到该地址并携带产品实例上下文。各产品通过 Casdoor SSO 获得无重复登录体验，不依赖跨域共享 Cookie。统一控制域名只设置 `ecp-ui` Cookie，不能为其他产品域名设置产品 Cookie。

单产品最小部署仍可把 `ecp-ui` 反向代理到产品的 `/admin/`，但这只是部署别名，不改变 ECP 的服务边界。

## 5. 企业、产品与实例模型

### 5.1 层级

```text
Enterprise
  ├── Application: apimind
  │     ├── ApplicationInstance: apimind-prod
  │     └── ApplicationInstance: apimind-test
  ├── Application: gpts
  ├── Application: ag-insight
  └── Application: nexterm
```

- `Enterprise` 是内部授权和数据隔离根；
- `Application` 表示一个产品类型；
- `ApplicationInstance` 表示一个产品的具体部署；
- 同一 Principal 可以加入多个产品，但产品权限默认隔离；
- 同一产品的不同实例也不得隐式共享角色和凭据。

### 5.2 多企业边界

首期每个 ECP 部署只允许一个有效 Enterprise，不提供企业选择器和跨企业管理员。所有相关表仍包含内部 `enterprise_id`，用于稳定命名空间和未来演进。

Casdoor 中一个 Organization 可映射一个内部 Enterprise，但 Casdoor Organization 名称不是内部主键。映射使用受控记录：

```text
enterprise_id
provider = casdoor
issuer
external_organization_id
```

未来若开放 ECP 的多企业模式，必须重新完成缓存、查询、审计、备份、运维和越权测试；仅增加 Casdoor Organization 不等于已经支持多企业。

## 6. 服务职责

### 6.1 Casdoor

Casdoor 是 G0 参考部署中的 IAM 运行时，负责：

- Organization、User 和 Group；
- 本地账号、密码、恢复和 MFA；
- LDAP、SAML、OIDC 等上游身份源；
- OAuth/OIDC 登录、SSO 和退出；
- Application 和 OAuth Client；
- Role、Permission 和 Casbin Policy；
- 身份侧会话、Token 和账号禁用。

ECP 优先使用 OIDC/OAuth 标准协议；必须使用 Casdoor 管理 API 的能力封装在 Casdoor Adapter 内。不得依赖 Casdoor SDK 私有行为、数据库表结构或 Casdoor 用户名作为内部事实来源。

### 6.2 ecp-api

`ecp-api` 负责：

- 企业、产品和产品实例注册；
- Casdoor Organization/User/Application 与内部 ID 的映射；
- 产品会话和撤销；
- Product Manifest 校验、版本和兼容性；
- 产品固定角色与 Casdoor/Casbin 策略编排；
- Connector 注册、认证、健康和能力协商；
- 服务身份和产品凭据元数据；
- 统一追加式审计；
- 企业安全策略；
- 旧产品用户、角色和成员数据的兼容投影；
- `ecp-ui` 所需的稳定 BFF API。

`ecp-api` 不拥有产品业务资源，不把资源正文复制到 `ecp_db`。

### 6.3 ecp-ui

`ecp-ui` 负责：

- 企业身份源状态、用户和用户组；
- 产品及产品实例；
- 产品成员、固定角色和资源授权；
- 服务账号、Token 和产品会话；
- 安全策略；
- 跨产品审计；
- 版本、健康和备份状态。

`ecp-ui` 只调用 `ecp-api`，不直接调用 Casdoor 和产品 `ecp-connector`。

前端技术栈固定为 React + TypeScript + Ant Design + Tailwind CSS + Vite。Ant Design 承担标准企业组件和交互语义，Tailwind CSS 只承担页面布局、间距、尺寸、响应式和少量无业务语义的工具样式；不得使用 Tailwind 重造 Ant Design 已提供的表格、表单、菜单、弹窗、抽屉、反馈和可访问性行为。

### 6.4 Product ecp-connector

产品 `ecp-connector` 负责把产品业务语义转换为统一 ECP 协议：

- 注册实例与能力；
- 提供资源摘要、资源层级和资源存在性；
- 在所有产品入口执行统一授权；
- 上报标准审计事件；
- 接收身份停用、策略版本变化和会话撤销；
- 维护旧系统兼容投影；
- 暴露产品健康和版本信息。

### 6.5 独立边界、Go module 与契约生成

ECP 作为当前单仓中的独立顶层目录建设，本阶段不拆为独立仓库，也不单独提交或发布；其内部仍保持可独立构建、部署和未来迁出的工程边界。目录和生成链路参照现有 ApiMind Server，不复制 YApi 兼容特例：

```text
ecp/
├── go.work
├── versions.lock.yaml
├── server/
│   ├── api/ecp.go
│   ├── api/internal/{handler,logic,middleware,svc,types}
│   ├── config/
│   ├── docs/ecp.api
│   ├── docs/apis/*.api
│   ├── etc/ecp*.yaml
│   ├── internal/service/
│   ├── internal/infra/{casdoor,connector,persistence/gorm}
│   ├── migrations/{postgres,mysql}
│   ├── scripts/{genapi.sh,gencontracts.sh,verify.sh}
│   └── go.mod              # module github.com/xfzen/ecp/server
├── sdk/go/
│   ├── connector/v1/
│   └── go.mod              # module github.com/xfzen/ecp/sdk/go
├── tools/
│   ├── go.mod
│   └── go.sum
├── ui/
│   ├── src/{app,api,auth,styles,...}
│   ├── tests/
│   ├── package.json
│   └── vite.config.ts
└── deploy/
```

固定规则：

- `ecp/server` 与 `ecp/sdk/go` 是两个独立 Go module；服务端只能依赖公开 SDK，SDK 不得导入服务端 `internal`、配置、持久化或业务实现；
- Connector 的版本化 wire types、错误码、签名/验签和 typed client 位于 `github.com/xfzen/ecp/sdk/go/connector/v1`。产品只能依赖该 SDK module 和 ECP HTTP API，不能通过相对路径或父仓库私有包集成；
- 当前 ApiMind 根 `go.work` 固定 `use ./ecp/server`、`./ecp/sdk/go` 和 `./server` 完成单仓构建与联调；未发布 SDK 只由 workspace 解析，ApiMind `go.mod` 不伪造远程版本且禁止提交本地 `replace`，生产构建和测试必须从仓库根工作区执行；
- SDK 的稳定 module/import path 从本阶段开始生效，但本阶段不要求创建规范远程仓库、tag 或 module checksum。未来决定拆仓时，必须先发布 `sdk/go/v0.1.0`（或当时确认的首个正式版本），在 `GOWORK=off` 的干净临时 module 中通过官方 Go Proxy 的下载、checksum、编译和测试，再向 ApiMind `go.mod` 加入已发布版本并移除根工作区 ECP `use` 项；
- ECP 拆仓验收必须在只复制 `ecp/` 的干净目录中完成服务、SDK、UI、Compose、生成和测试，任何对父仓库 `server/`、`web/`、`deploy/` 或脚本的依赖都视为失败；
- `ecp/server/docs/ecp.api` 是唯一 goctl HTTP 契约入口，导入 `docs/apis/*.api` 的分域类型；
- `scripts/genapi.sh` 使用 `goctl api go -api docs/ecp.api -dir api`，并像 ApiMind 一样规范化契约文件尾部、删除不归生成器所有的 `api/etc` 与 `api/internal/config`；
- `scripts/gencontracts.sh` 顺序执行 API 生成和 OpenAPI 生成；不复制 ApiMind 特有的 YApi Compatibility、MCP Tools 或手写 Handler 清理清单；
- `api/internal/handler/routes.go` 与 `api/internal/types/types.go` 由 goctl 生成且禁止手改；Handler/Logic 保持薄层，业务规则进入 `internal/service/*`；
- `api/internal/svc/ServiceContext` 只装配配置、GORM Repository、Casdoor Adapter、Connector Client、缓存、Clock 和 ID Generator，不承载业务规则；
- GORM Entity、Repository 和方言实现位于 `internal/infra/persistence/gorm`；API Handler 不得直接访问 GORM；
- `scripts/verify.sh` 必须验证重复生成幂等、生成后工作区无差异、`gofmt`、`go test ./...`、`go vet ./...`、`ecp-api` 构建和 PostgreSQL/MySQL 迁移矩阵。
- `versions.lock.yaml` 锁定 Go 工具、goctl 插件、前后端直接依赖、Casdoor 和数据库镜像的精确版本及不可变 digest/checksum；只允许官方发布源。生成器从 `ecp/tools/go.mod` 构建固定版本的本地工具，不能依赖 PATH 中的偶然版本。

HTTP 契约按安全边界分组：`meta-public` 只含健康/版本读取；`auth-public` 只含 OIDC start/callback 并执行登录限流与事务校验；`admin-read` 执行 Admin Session；`admin-write` 执行 Admin Session、CSRF、Idempotency 和限流；`connector-machine` 执行 Connector Credential、Audience/Scope、Idempotency 和限流；`key-maintainer` 只接受独立离线 operator credential、`keyset.publish` Scope、Idempotency 和限流，不能由浏览器、Connector、Casdoor Adapter 或在线 Delegation key 调用。`GET /api/v1/auth/session` 是 ecp-ui 当前会话摘要，`GET /api/v1/auth/sessions` 是管理员会话集合，二者不得混用。生成路由测试必须证明所有受保护端点进入正确 middleware group。

## 7. 数据所有权与数据库

### 7.1 数据库拓扑

```text
casdoor_db
  Casdoor organization/user/application/role/permission/session

ecp_db
  enterprise/application/instance/mapping/product_session
  manifest/connector/audit/outbox/security_config

product_db
  由各产品独占的业务数据
```

硬约束：

- 三类数据库必须为独立 database；
- 即使位于同一 PostgreSQL/MySQL 集群，也使用不同账号和最小权限；
- 不共享表，不建立跨库外键，不执行跨库 Join；
- 不使用跨库分布式事务；
- 每个数据库使用独立迁移版本和备份；
- 产品服务不得访问 `ecp_db` 和 `casdoor_db`；
- `ecp-api` 不得访问产品数据库和 Casdoor 数据库；
- 所有跨域交互通过版本化 API 和事件完成。

### 7.2 ecp_db 逻辑表

| 表 | 作用 |
| --- | --- |
| `enterprise` | 企业根与状态；首期单有效记录 |
| `application` | 产品定义和命名空间 |
| `application_instance` | 产品实例、环境和状态 |
| `connector_registration` | Connector 地址、版本、能力和凭据引用 |
| `oidc_client_registration` | `ecp-ui`/产品实例对应的 Casdoor Client、精确 Redirect URI、Secret Reference、状态和版本 |
| `identity_mapping` | Casdoor身份到内部 Principal 的稳定映射 |
| `principal_access_state` | 产品访问的本地拒绝覆盖、来源、版本和外部同步状态 |
| `identity_sync_state` | Enterprise/Provider 维度的最后成功同步时间、源游标或版本、新鲜度、错误和对账状态 |
| `principal_group_mapping` | Casdoor Group 到内部稳定 Group ID 的映射，不复制完整成员关系 |
| `external_group_mapping` | 上游目录 Group 到内部 Group 的受控映射 |
| `legacy_identity_mapping` | 产品旧用户 ID 映射 |
| `admin_session` | `ecp-ui` 的企业级控制台会话 |
| `product_session` | 具体产品实例会话、到期、撤销和风险状态 |
| `login_transaction` | 短时、一次性的 OIDC state、PKCE 和产品登录交接状态 |
| `product_manifest` | 资源、角色、动作和能力清单版本 |
| `policy_projection` | Casdoor产品策略 ID、规范化 Hash、版本和对账状态；不是第二份授权事实 |
| `resource_reference` | 可选资源摘要缓存，不保存业务正文 |
| `service_principal_mapping` | OAuth Client 与产品机器身份映射 |
| `audit_event` | 统一追加式审计 |
| `projection_outbox` | 兼容投影和失败重试 |
| `product_security_config` | 产品级企业安全策略 |

### 7.3 PostgreSQL/MySQL 兼容

`ecp-api` 使用 go-zero + GORM，正式支持 PostgreSQL 和 MySQL。兼容性必须由约束和测试保证，不能仅以“GORM 可切换 Driver”作为完成证据：

- 关键关系使用正规列和关联表，不依赖 JSON 查询；
- 不依赖 PostgreSQL JSONB、数组、部分索引或 MySQL 专有 SQL；
- 主键、唯一约束、时间精度、排序和大小写规则使用共同子集；
- 方言差异集中在 repository/dialect 边界；
- 使用版本化迁移，不以运行时 `AutoMigrate` 替代正式升级；
- PostgreSQL 和 MySQL 均进入迁移、回滚、并发和集成测试矩阵；
- 一个 `ecp-api` 实例只连接其中一种关系数据库。

## 8. Product Manifest

每个产品通过版本化 Manifest 声明控制面能力：

```yaml
apiVersion: ecp/v1
product: apimind
displayName: ApiMind

resourceTypes:
  - workspace
  - project
  - cat
  - interface

roles:
  - id: workspace.owner
    resource_type: workspace
    actions: [workspace.read, workspace.manage, workspace.member.manage]
  - id: project.viewer
    resource_type: project
    actions: [project.read, interface.read, document.read]

actions:
  - workspace.manage
  - project.read
  - project.write
  - member.manage
  - data.export

capabilities:
  resourceDirectory: true
  serviceAccounts: true
  auditIngestion: true
```

约束：

- 产品、资源、角色和动作使用稳定机器标识，不使用展示名称；每个可绑定角色必须显式声明唯一 `id`、适用 `resource_type` 和固定 `actions`，ECP 不根据角色名称猜测权限；
- 动作使用产品命名空间，避免跨产品冲突；
- Manifest 只能声明固定模型，不能嵌入任意策略代码；
- Manifest 升级必须声明兼容范围和废弃项；
- ECP 至少兼容当前版本和前一版本；
- 不允许产品通过 Manifest 注入任意 `ecp-ui` 脚本。

## 9. 身份与会话

### 9.1 登录

正式登录统一使用 OIDC Authorization Code + PKCE，但 ecp-ui 与产品使用不同的同源回调和会话：

```text
ecp-ui:
Browser → enterprise.example.com/auth/start → Casdoor
        → enterprise.example.com/auth/callback → Admin Session

Product:
Browser → product.example.com/api/enterprise/auth/start → Casdoor
        → product.example.com/api/enterprise/auth/callback
        → Product Connector exchanges one-time transaction with ecp-api
        → Product backend sets same-origin Product Session Cookie
```

- 不代理用户密码；
- 不长期保留第二套本地认证系统；
- Casdoor SSO 会话负责跨产品认证；
- Admin Session 绑定 Enterprise 和 Principal，只能访问共享控制台；
- Product Session 绑定 Enterprise、ApplicationInstance 和 Principal，只能访问对应产品实例；
- Admin Session 与 Product Session 不共享 Cookie、Session ID 或 CSRF 状态；
- Product Connector 只能使用短时、单次、绑定 ApplicationInstance、Redirect URI、state、PKCE 和浏览器 nonce 的 `login_transaction` 完成会话交接；
- ecp-api 不把 Casdoor Token 或可重放登录结果暴露给浏览器。

### 9.1.1 OIDC Relying Party 边界

- ecp-ui 和每个 ApplicationInstance 分别注册独立 Casdoor Application/OIDC Client，不跨产品、实例或环境复用；
- G0 的服务端 Web 产品使用 Confidential Client + Authorization Code + PKCE，Client Secret 只由 ecp-api 的受控 Secret Reference 保存，Product Connector 和浏览器都不能取得；
- 每个 Client 只允许预注册的精确 HTTPS Redirect URI，禁止通配符、用户输入 Redirect URI 和开放重定向；
- 本机开发可以显式允许固定 localhost URI，但不能进入生产配置；
- Product Instance 注册或域名变更必须验证 Canonical Base URL，并作为高风险操作重新认证和审计；
- Redirect URI、Client 状态和 Secret Version 写入 `oidc_client_registration`，原始 Secret 不进入数据库普通字段；
- Dynamic Client Registration 在生产默认关闭；若目标环境启用，必须单独审批、限流和审计；
- Client Secret 轮换支持新旧短暂重叠，过渡结束后旧 Secret 立即撤销；
- ecp-ui Client、产品 OIDC Client、Casdoor Adapter Credential 和 Connector Credential 是不同信任对象。

### 9.2 产品会话

Admin Session 和 Product Session 必须：

- 使用随机不可预测 ID；
- 通过 `HttpOnly`、`Secure`、受控 `SameSite` Cookie 传递；
- 按会话类型绑定 Enterprise/Principal 或 Enterprise/ApplicationInstance/Principal；
- 可列出、单独撤销和全部撤销；
- 用户禁用后进入立即撤销流程；
- 高风险操作支持重新认证；
- 不以邮箱作为身份键；
- Casdoor Token 如需持久化必须加密。

产品退出只撤销当前 Product Session；ecp-ui 退出只撤销 Admin Session；全局退出同时撤销该 Principal 的控制台和产品会话，并触发 Casdoor SSO 退出。

### 9.3 生命周期

默认采用预创建或邀请模式，未知外部身份拒绝访问。JIT 必须显式启用，并同时满足：

- Identity Provider 和 OIDC Issuer 位于 Enterprise 允许列表；
- 外部身份严格使用 `issuer + subject` 映射，不使用邮箱或用户名替代 Subject；
- 若使用企业邮箱域作为准入条件，Claim 必须包含 `email_verified=true`，且该 Provider 被配置为可信邮箱断言来源；
- 邀请模式下，一次性 Invitation 绑定 Enterprise、Application、规范化邮箱、到期时间和使用状态；
- Group Claim 只有已建立稳定 External Group Mapping 且位于 JIT 允许列表时才参与准入；
- 首次 JIT 只创建内部 Principal 映射和最低产品成员关系，不授予 Workspace、Project 或其他业务资源角色；
- 同邮箱跨 Provider、不同 Issuer 或不同 Subject 不自动合并；发现已有冲突身份时拒绝并进入管理员审计处理。

JIT 不解决离职撤销，也不能绕过预创建、Seat或产品启用策略。

用户禁用流程必须撤销产品会话和个人 Token，同时保留历史作者、审计归属和默认不生效的角色绑定。`blocked` Principal 的任何角色都不能产生 Allow；只有明确的离职策略才移除角色、转移所有权或关闭其个人资源，并分别记录审计。Casdoor管理员不自动获得产品业务数据权限。

ecp-api 维护最小 `principal_access_state`，只表达 `active/blocked/pending_external_sync` 和单调版本，不复制 Casdoor 用户资料。通过 ecp-ui 发起禁用时固定为：

```text
Audit Intent
  → Set Local Access State = blocked
  → Revoke Admin/Product Sessions and Personal Tokens
  → Publish Lifecycle Version
  → Disable Casdoor User through Adapter
  → Reconcile Optional Offboarding Policy
  → Audit Outcome
```

本地 `blocked` 是产品访问的强制拒绝覆盖。即使 Casdoor 写入暂时失败，产品访问仍保持拒绝，状态标记为 `pending_external_sync` 并持续对账；不得因为外部同步失败重新开放产品访问。

在 Casdoor UI 或外部目录发生的停用通过 Casdoor事件能力接收；若目标 Casdoor版本不能提供可靠事件，则 ecp-api 使用增量轮询。G0 默认约束：

- 外部停用到 ecp-api 发现的最大时延不超过 5 分钟；
- Lifecycle Version 产生后，在线 Connector 在 60 秒内获得拒绝覆盖；
- Product Session 和低风险授权缓存最长 5 分钟重新校验一次 Principal 状态；
- 高风险操作、ecp-ui 和凭据管理每次请求重新校验，不使用旧 Principal 状态；
- Connector 离线恢复后必须先同步最新 Lifecycle Version，再接受旧会话；
- ecp-ui 显示 Casdoor/目录最后同步时间、延迟和失败状态。

上述外部停用时效以身份同步持续健康为前提，但同步故障不能把旧 Allow 无限延长。ecp-api 为每个 Enterprise/Provider 维护 `identity_sync_state`：`last_successful_sync_at`、源游标或版本、`fresh/stale`、最后错误和对账状态。授权固定遵守：

- 身份新鲜度上限默认 5 分钟，可缩短、不可关闭；超过 `last_successful_sync_at + 5 分钟` 即进入 `stale`；
- 人类 Principal 以及依赖 Group 成员关系的决策，只能在 `fresh` 时产生或续期 Allow；已有 Allow 的绝对到期时间不得晚于该新鲜度截止点；
- 一旦进入 `stale`，ecp-ui、高风险操作、凭据管理、资源发现和普通产品访问均拒绝，返回 `identity_state_stale`，不能以低风险读取或旧 Casbin Allow 继续放行；
- ecp-api 本地已经形成的 `blocked`/`pending_external_sync` 始终优先拒绝，不受 Casdoor 可用性或同步状态影响；
- 不依赖人类或 Group 状态的 Service Principal 可继续按自身 Principal、Credential、Policy 和 Resource Version 判定，不能借此代表用户执行委托操作；
- Lifecycle 事件和授权响应同时携带 Identity Sync Version/Freshness Deadline，Connector 不得在本地越过该截止点续期 Allow；
- Connector 离线或同步恢复后，必须完成一次增量对账；无法证明游标连续时执行全量对账，成功后才可把状态恢复为 `fresh`；
- ecp-ui 必须显著显示 `stale`、最后成功时间、失败来源和恢复进度，不能只显示“Casdoor 可用”。

目标企业可以缩短以上时限，不能配置为无限期。Casdoor事件能力、轮询增量键以及可证明连续性的游标语义标记为“需要验证”。

### 9.4 用户组

企业用户组是跨产品授权主体，首期直接使用 Casdoor Group 及其直接成员关系；ecp-api 只保存稳定内部 Group ID、Casdoor Group 映射和上游目录 Group 映射，不复制一份可独立修改的成员清单。

用户组分为：

- `ecp_managed`：通过 ecp-ui 管理，ecp-api 调用 Casdoor Group API；
- `directory_managed`：由 LDAP/SCIM/上游 IdP 同步，在 ecp-ui 中只读；
- `system`：ECP 内置，不能由普通企业管理员删除。

约束：

- 首期只支持直接成员，不支持嵌套组和跨 Enterprise 组；
- 上游 Group 使用 Provider、Issuer 和稳定 External Group ID 映射，不能用展示名称自动合并；
- JIT Claim 中未建立映射的 Group 默认忽略，不能自动产生产品权限；
- Group 到产品角色的绑定进入 Casdoor/Casbin 产品策略命名空间；
- 删除 Group 前必须先处理产品角色绑定；目录侧删除后进入禁用和对账流程，不静默重建；
- 用户组、成员变化、外部映射和产品角色绑定全部进入企业审计；
- Casdoor Group 稳定标识、API 和目录同步行为在实施前标记为“需要验证”。

## 10. 授权

### 10.1 职责分离

- 产品定义资源、动作、固定角色和继承规则；
- ecp-api校验 Manifest 并把产品语义编排为 Casdoor/Casbin 策略；
- Casdoor/Casbin 保存并执行策略；
- 产品在 Web、HTTP、MCP、Runner、Worker 和定时任务入口执行决策。

统一授权决策顺序固定为：

```text
Validate Transport and Enterprise/Application/Instance Boundary
  → Resolve Principal and Session/Credential
  → Check Principal Access State, Lifecycle Version and Identity Freshness
  → Check Session/Credential Revocation
  → Check Policy Drift State
  → Validate Cache Policy/Lifecycle Versions
  → Evaluate Casdoor/Casbin Policy
  → Return Decision and Reason
```

- 人类 Principal 只有 `principal_access_state=active` 才能继续；`blocked` 和 `pending_external_sync` 都立即拒绝；
- Service Principal 只有主体和当前 Credential 都为 active 才能继续；
- Principal 拒绝覆盖优先于直接角色、Group继承、owner recovery 和 Casbin Allow；
- 缓存的 Allow 必须携带 Lifecycle Version、Identity Sync Version/Freshness Deadline、Policy Version 和 Authorized Resource Version，任一版本变化或超过截止时间立即失效；
- Principal 状态或新鲜度无法确认时不得调用 Casbin后把 Allow 当作最终结果；
- 拒绝返回稳定 Reason，例如 `principal_blocked`、`credential_revoked`、`identity_state_stale` 或 `policy_drifted`。

产品策略使用 ecp-api 管理的保留命名空间：

```text
enterprise/{enterprise_id}/application/{application_id}/instance/{instance_id}/...
```

- Casdoor 中该命名空间的 Role、Permission 和 Policy 是授权事实来源；
- ecp-ui 和 Connector 只能通过 ecp-api 修改产品策略；
- 直接通过 Casdoor UI/API 修改保留命名空间属于不受支持操作；
- `policy_projection` 只记录经 ECP 对账的 Casdoor Permission ID、Policy ID、规范化 Hash、Manifest Version、Policy Version 和最后对账状态，不保存一份可独立编辑的 Grant；产品授权请求不得指定或覆盖 Permission ID；
- ecp-ui 的权限查询通过 ecp-api 读取 Casdoor事实并使用受版本约束的短期缓存；
- Casdoor恢复后可以从 Casdoor策略重建 `policy_projection`，不能用 Projection 反向覆盖未经确认的策略。

策略写入流程固定为：

```text
Validate Manifest/Resource
  → Authorize Admin Operation
  → Audit Intent
  → Mutate Casdoor Policy through Adapter
  → Read Back and Canonicalize
  → Verify Hash
  → Advance Policy Version
  → Invalidate Product Caches
  → Audit Outcome
```

周期性对账比较 Casdoor规范化策略与 `policy_projection`。发现未知修改、缺失或部分写入时：

- 标记受影响策略为 `drifted`；
- 停止该范围的进一步策略写入；
- 立即失效该范围全部缓存 Allow；
- 该范围所有新授权决策按拒绝处理，包括只读和资源发现；
- 生成企业安全告警和审计事件；
- 仅允许不读取产品业务数据的隔离诊断和修复入口继续使用；
- 修复页面展示 Casdoor当前策略与最后已验证 Hash 的规范化 Diff；
- 具有策略修复权限的管理员重新认证后，可以显式接受 Casdoor当前事实或按已审计操作重放；接受操作生成新的 Policy Version、Projection Hash 和完整审计，不能静默覆盖。

首期不在漂移状态下继续使用 last-known-good Allow 快照。若未来为了可用性引入该能力，必须另行证明快照未扩大权限并修订本 Spec。

统一决策接口：

```text
Authorize(
  enterprise_id,
  application_id,
  application_instance_id,
  principal_id,
  action,
  resource_type,
  resource_id,
  resource_ancestry,
  resource_version,
  context
) → allow / deny / reason
  / lifecycle_version / identity_sync_version / identity_freshness_deadline
  / policy_version / authorized_resource_version
```

### 10.2 Casdoor/Casbin 验证门槛

正式采用前必须验证：

- 产品资源层级和角色继承；
- 显式角色覆盖和 restricted resource；
- 多产品、多实例和企业命名空间隔离；
- 批量决策性能；
- 策略变更和缓存失效；
- 保留命名空间、直接 Casdoor 修改、部分写入和恢复后的漂移对账；
- 策略备份、恢复、升级和审计；
- 故障期间默认拒绝行为。

这些项目当前标记为“需要验证”。若验证失败，必须修订本 Spec，不能在产品代码中静默增加第二套授权事实来源。

### 10.3 缓存

- 低风险读取允许短 TTL 决策缓存；
- 策略返回 `policy_version`，变更后产品主动失效；
- 高风险管理操作不得使用过期缓存；
- 缓存键必须包含 Enterprise、ApplicationInstance、Principal、Action 和 Resource；
- Allow 缓存值必须包含 Lifecycle Version、Identity Sync Version/Freshness Deadline、Policy Version 和 Authorized Resource Version；
- 人类或 Group 相关 Allow 的缓存 TTL 必须取自身 TTL 与 Identity Freshness Deadline 的较早者，过期后不能在 ecp-api 或 Casdoor 不可用时本地续期；
- 无法证明安全的缓存命中必须按拒绝处理。

## 11. Connector 契约

### 11.1 产品调用 ecp-api

```text
RegisterInstance
Heartbeat
ResolveSession
Authorize / BatchAuthorize
IngestAuditEvents
GetPolicyVersion
PollLifecycleChanges
```

### 11.2 ecp-api 调用产品

```text
GetCapabilities
SearchResources
ResolveResource
GetResourceAncestry
ApplyCompatibilityProjection
GetHealth
GetVersion
```

`ecp-api` 的机器凭据只证明调用方是 ECP，不能代表当前企业管理员拥有产品业务权限。涉及资源目录、资源解析和兼容投影的请求必须同时携带短期签名 Delegation：

```text
issuer = ecp-api
audience = ApplicationInstance
enterprise_id / application_id / instance_id
actor_principal_id / admin_session_id
requested_action / purpose
operation_id / nonce / expires_at
policy_version / lifecycle_version
identity_sync_version / identity_freshness_deadline
```

- Delegation 最长有效 60 秒，绑定单个 Product Instance 和用途；
- Product Connector 同时验证 `ecp-api` 机器凭据和 Delegation 签名、Audience、Nonce 及到期时间；
- 人类 Actor 或 Group 相关 Delegation 不得晚于 Identity Freshness Deadline；Identity 状态 stale 时 ecp-api 不签发，Product Connector 也不得接受；
- 产品使用实际 Actor 和 Requested Action 执行资源授权，不能把 ecp-api 机器身份当作业务管理员；
- `SearchResources` 必须按 Actor 可管理范围过滤，未授权资源的 ID、名称和存在性都不能返回；
- 后台健康检查等无用户任务使用显式 `system` Purpose，只能访问预先允许的非业务元数据；
- `ApplyCompatibilityProjection` 绑定已授权角色变更的 Operation ID，不能成为任意产品数据写入口；
- Delegation 失败、重放或 Actor 授权失败按拒绝处理并记录审计。

### 11.3 契约规则

- `ecp-ui` 只访问 `ecp-api`；
- Connector 只返回资源 ID、名称、类型和必要层级，不返回业务正文；
- ResolveResource 和 GetResourceAncestry 必须返回可比较的 `resource_version`；父级、访问模式或授权根变化必须产生新版本；
- 高风险写入必须携带授权时的 `authorized_resource_version`，产品提交业务变更前重新比较；版本不一致时拒绝当前写入并重新授权；
- 每个产品实例使用只面向 ecp-api audience 的独立 Connector Client 或等价机器身份；
- Connector Client 不能调用 Casdoor 管理 API，也不能复用 ecp-api 的 Casdoor Adapter 凭据；
- 每个请求绑定 Enterprise、Application 和 Instance；
- 用户发起的 ECP 到产品请求还必须绑定 Actor、Admin Session、Requested Action 和 Purpose；
- Connector 不得访问其他产品；
- 写请求必须包含幂等键和操作 ID；
- API 使用明确版本和能力协商；
- 产品离线不能阻断控制台的全局页面或其他产品。

### 11.4 SDK 与签名密钥生命周期

G0 的 ECP→产品 Delegation 和审计归档 Manifest 使用 Ed25519。签名载荷必须采用版本化规范编码并携带 `alg=EdDSA`、`kid`、签发方、受众、签发/到期时间和用途，禁止算法协商降级。

- 私钥只能由 `SecretProvider` 注入 `ecp-api` 或离线审计维护命令，不进入 `ecp_db`、日志、导出、镜像或前端；
- 产品通过 SDK 的受控公钥集接口按 `kid` 验签。Delegation 在线签名私钥与离线 KeySet-root 私钥分离；root 私钥不挂载到 `ecp-api`，只用于离线签署规范化 KeySet envelope。Connector 注册在已认证 TLS 通道返回首个已签名 KeySet 和 root fingerprint，生产实例还必须通过部署配置预置并校验该 root fingerprint；后续使用机器认证的 `GetDelegationKeySet` 与 `AckDelegationKeySet`。Envelope 包含单调版本、用途、前一版本/fingerprint、`kid`、算法、公钥、有效期、状态、规范化 payload hash、root signing key ID 和 root signature；
- 离线 key-maintainer 通过独立 SecretProvider 使用 root 私钥签名，再以只能调用 `PublishDelegationKeySet` 的 operator credential 提交；不得直接写数据库。ecp-api 只在验证预配置 root fingerprint/signature、单调版本和前一版本链后保存已签名 envelope；浏览器、Connector Credential、Casdoor Adapter Credential 和在线 Delegation key 均不能发布 KeySet；
- Connector 必须先验证并原子持久化新 KeySet，再确认确切版本与接受的 `kid`；ecp-api 只有在所需在线 Connector 全部确认后才切换签发。离线 Connector 在确认前进入降级状态且不能接收新的签名管理操作；公钥集获取失败时只能继续使用尚未过期且已验证的缓存，未知 `kid` 默认拒绝；
- 轮换采用“发布新公钥 → 等待所有在线 Connector 确认 → 使用新私钥签发 → 保留旧公钥完成验证窗口 → 撤销旧私钥”的顺序；同一用途最多一个当前签名密钥和一个轮换中的签名密钥；
- Delegation 旧公钥至少保留“最大有效期 + 最大时钟偏差 + Connector 公钥缓存 TTL”；审计归档的历史公钥必须按审计保留期保存，不能因在线签名轮换而丢失历史验证能力；
- 密钥生成、启用、轮换、撤销、异常回滚和公钥集变化都进入追加式审计；私钥丢失或泄露有独立恢复流程；
- 紧急撤销使用单调递增的新 KeySet；若初始 trust fingerprint 或其根密钥泄露，必须通过带人工确认的带外方式重新 bootstrap，不能依赖已失陷的在线通道自证；
- Nonce 重放状态必须持久化并按 issuer、audience、purpose 隔离，服务重启不能清空尚在有效窗口内的防重放记录；
- `github.com/xfzen/ecp/sdk/go/connector/v1` 提供规范编码、Ed25519 签名/验签、错误码和 typed client；服务端和产品不得各自复制另一套协议实现。

## 12. ecp-ui

### 12.1 信息架构

```text
企业控制台
├── 全局
│   ├── 用户与用户组
│   ├── 身份源
│   ├── 安全策略
│   ├── 产品与实例
│   └── 跨产品审计
└── 产品
    ├── 成员与角色
    ├── 资源授权
    ├── 服务账号
    ├── 产品安全策略
    └── 健康与版本
```

### 12.2 通用化边界

- 固定角色、资源选择器和通用安全配置由 Manifest 驱动；
- 少量产品特有配置使用受控 Schema 表单；
- 业务配置保留在产品自身 UI；
- 无法通用表达时提供产品深链接；
- 第一阶段不使用微前端，不加载产品提供的任意 JavaScript；
- ecp-ui 不直接暴露 Casdoor Model、Adapter、Permission 等底层概念。

### 12.3 前端技术与样式边界

- 使用 React 18 + TypeScript 构建组件与页面，Vite 负责开发、测试集成和生产构建；
- Ant Design 是唯一的标准组件基座，表单、表格、树、菜单、分页、弹窗、抽屉、通知、结果页和交互状态优先使用 Ant Design；图标统一使用 `@ant-design/icons`；
- Tailwind CSS 4.x 用于 `flex/grid`、间距、尺寸、对齐、响应式断点及少量工具样式，不建立第二套按钮、输入框、表格或反馈组件体系；
- 颜色、圆角、字体、密度和状态色以 Ant Design Theme Token 为主，通过 `ConfigProvider` 集中配置；需要被 Tailwind 使用的产品语义值通过受控 CSS Variables 暴露，不在页面中散落任意颜色值；
- Tailwind 不加载 Preflight，全局元素重置由应用显式控制，避免覆盖 Ant Design 的基础样式；禁止使用高优先级全局选择器批量覆盖 Ant Design 内部类名；
- 页面组件优先组合 Ant Design 属性和 Theme Token；只有布局工具类进入 JSX，复杂可复用样式进入 `src/styles`，不得用大段任意值工具类代替组件抽象；
- 不从 CDN 运行时加载 React、Ant Design、Tailwind、字体或产品脚本；所有依赖从官方 npm Registry 解析并锁定到 `package-lock.json`；
- 浏览器网络边界保持不变：`ecp-ui` 只访问同源 `ecp-api`，Vite 开发代理也只能指向本地 Go 服务。

## 13. 服务身份、Secret 与数据暴露

- 浏览器用户、服务账号和系统 Connector 使用不同 Principal 类型；
- MCP、CI、Runner 不得使用浏览器会话；
- 服务账号绑定 Enterprise、ApplicationInstance 和显式资源范围；
- Token 原文只展示一次，产品侧不得明文持久化；
- 支持过期、轮换、撤销、最近使用和来源审计；
- Secret 和 Token 不得进入页面、日志、错误、审计差异或导出；
- 公开分享、导入导出和敏感资源访问由产品声明并接受企业策略控制；
- 服务身份不能通过 ECP 获得其他产品的隐式权限。

## 14. 审计

### 14.1 独立审计模型

`audit_event` 与任何产品业务动态表分离，采用追加写模型，普通管理员不能更新或删除。

存储层必须使用独立数据库角色：

- `ecp_schema_owner`：仅由离线迁移/数据库 bootstrap 命令使用，拥有创建/变更 ECP schema、数据库角色和 GRANT 所需权限，不作为在线服务或普通运维命令凭据；
- `ecp_tx_writer`：允许 ECP 业务表所需 DML，并只允许向 `audit_event` 执行 INSERT；不得对审计执行 UPDATE、DELETE 或 TRUNCATE；
- `audit_ingest_writer`：只允许向 `audit_event` 执行 INSERT，用于产品事件摄取及事务外的 Intent/Outcome；
- `audit_reader`：只允许受控 SELECT，不能获得写权限；
- `audit_maintainer`：仅用于到期归档、归档校验和审计恢复，不拥有 schema/角色管理权限，也不作为在线服务常驻凭据；
- ecp-api 普通业务 Repository 不持有 `audit_maintainer` 凭据；
- 需要业务变更与审计原子提交时，由同一个 Transaction Coordinator、同一数据库连接和同一事务使用 `ecp_tx_writer`；Repository 不得各自开启连接模拟同一事务；
- ecp-ui 不存在修改、删除或清空审计的 API；
- PostgreSQL/MySQL 都必须验证实际 GRANT，而不能只依赖 GORM Repository 不提供删除方法。

在线进程还必须使用彼此独立的连接池和 DSN/Secret Reference：业务事务池使用 `ecp_tx_writer`，产品审计摄取与事务外 Intent/Outcome 使用 `audit_ingest_writer`，审计查询使用 `audit_reader`。`ecp_schema_owner` 只出现在离线迁移/bootstrap 配置中，`audit_maintainer` 只出现在离线归档/恢复配置中；二者都不得注入在线 `ServiceContext`，不能通过在同一高权限连接上切换 Repository 来模拟角色隔离。

自托管环境中的数据库超级管理员最终仍可修改数据，基础 G0 不宣称能够对抗基础设施 Root。需要防篡改证明的企业使用条件性能力：外部不可变 Audit Sink、WORM 存储、签名导出或事件 Hash Chain。

核心字段包括：

- `event_id`、`schema_version`、时间和 operation/request ID；
- Enterprise、Application、Instance；
- Actor Principal、认证提供方、会话和来源入口；
- IP、User-Agent；
- Action、Resource 及资源层级；
- Authorization Decision、Outcome 和 Reason；
- 脱敏后的 Change Summary 和 Safe Diff；
- 敏感级别和保留策略。

每个事件具有 Enterprise 内单调序号。导出和归档生成包含起止序号、事件数量、规范化内容 Hash、版本和签名信息的 Manifest，用于发现缺失或重排。

### 14.2 覆盖范围

- 登录成功/失败、退出、会话撤销；
- 用户、用户组、IdP 和安全策略；
- 产品成员、角色和资源授权；
- 服务账号、Token、Secret；
- 导入、导出、公开分享；
- 被拒绝的高风险操作；
- 备份、恢复、升级和管理员接管；
- 产品声明的关键业务写入。

### 14.3 跨库操作

控制数据库内的高风险管理变更使用三阶段流程：

```text
1. audit_ingest_writer: Commit Audit Intent
2. ecp_tx_writer in one DB transaction:
     Business Mutation + Insert Change-Committed Audit Event
3. audit_ingest_writer: Commit Success/Failure Outcome
```

- Audit Intent 写入失败时不开始业务事务；
- 业务事务回滚时，Change-Committed Event 必须一起回滚，再单独写入 Failure Outcome；
- 业务事务提交后，即使最终 Outcome 暂时失败，也已经存在不可分割的业务变更与 Change-Committed Event；
- PostgreSQL和MySQL都必须验证事务回滚、连接中断和重复Operation ID场景。

产品业务写入不使用分布式事务：

```text
Authorize → Audit Intent → Product Operation → Audit Outcome
```

产品侧审计 Intent 写入失败时，高风险操作失败关闭。Outcome 写入失败时保留未完成 Intent，并通过幂等 operation ID 对账和补偿。

### 14.4 保留与归档

- 普通管理员只能配置允许范围内的保留策略，不能立即删除历史；
- 到期事件由离线 `audit_maintainer` 执行版本化归档流程；
- 归档在删除在线副本前必须完成完整性校验并生成签名 Manifest；
- 保留策略变化、归档、恢复和归档失败写入独立运维审计；
- 归档介质损坏或校验失败时不得清理在线事件；
- SIEM、外部不可变 Sink 和自定义保留周期按目标企业要求条件性进入 G0。

## 15. 私有部署、备份与升级

### 15.1 受支持部署

首期必须提供低门槛单机私有部署，并允许生产环境外置 Casdoor、关系数据库、产品数据库和反向代理。高可用、在线一致性快照和跨地域灾备属于条件性能力。

### 15.2 备份

一次完整企业备份至少覆盖：

- Casdoor 数据库；
- Enterprise Control 数据库；
- 所有已注册产品的产品数据备份；
- 产品和 ECP 配置；
- 必要的对象文件；
- 版本、时间点、校验和及兼容信息清单。

基础模式允许短暂只读窗口生成一致性备份。加密密钥与数据备份分开保管。

### 15.3 恢复

- 支持恢复到空环境；
- 恢复工具验证版本和校验和；
- 恢复后检查 Casdoor映射、产品实例、角色策略和孤立资源；
- 每个受支持版本必须完成真实恢复演练；
- 仅存在备份文件而未验证恢复不算通过。

### 15.4 升级

- Casdoor、ecp-api、ecp-ui、Connector 和产品形成兼容矩阵；
- Casdoor版本固定，不无约束跟随最新版；
- 升级前执行连接、空间、版本和备份预检；
- 数据库迁移优先采用向后兼容的增量变化；
- 可逆升级可以回滚程序；不可逆迁移必须通过恢复路径处理；
- 不承诺未经演练的“一键回滚”。

## 16. 故障与安全边界

| 故障 | 默认行为 |
| --- | --- |
| Casdoor 不可用 | 禁止新登录和策略变更；人类及 Group 相关的已有 Allow 最多使用到既有 Identity Freshness Deadline，进入 stale 后全部拒绝且不得续期 |
| ecp-api 不可用 | 管理和高风险操作拒绝；低风险读取仅可使用未到自身 TTL、Lifecycle/Policy/Resource Version 且未越过 Identity Freshness Deadline 的既有缓存，禁止本地续期 |
| 单个 Connector 不可用 | 该产品管理只读或不可用；其他产品和全局功能继续工作 |
| 审计暂时不可用 | 高风险写入失败关闭；允许的普通事件进入本地 Outbox 后补交 |
| 产品数据库不可用 | ECP 保留实例故障状态，不修改或推测产品资源 |

安全约束：

- ecp-api 调用 Casdoor 管理 API 使用独立的 Casdoor Adapter Credential；该凭据按 Enterprise 隔离、只保存在受控 Secret 中、不得下发给 ecp-ui 或 Connector，并执行轮换和使用审计；
- Product Connector 调用 ecp-api 使用独立 Connector Credential，Token audience 必须是 ecp-api，Scope 只允许该 ApplicationInstance 的注册、授权、审计和生命周期 API；
- ecp-api 调用 Product Connector 使用第三套独立凭据，不能反向复用产品入站凭据；
- ecp-ui 和每个产品实例使用独立 OIDC RP Client，作为第四条信任通道；其 Secret 只用于对应 OIDC Code Exchange；
- 四条信任通道不得共享 Client ID、Client Secret、Token 或 Cookie；
- 服务间优先使用 OAuth Client Credentials；需要更高隔离时增加 mTLS；
- Connector 凭据不得跨产品、跨实例或跨 Enterprise 复用；
- Casdoor本地紧急管理员用于企业上游 IdP 故障，不赋予产品数据权限；
- Casdoor自身故障依靠恢复，不设置长期隐藏的产品绕过账号；
- 所有管理写入要求 CSRF、防重放、限流和幂等保护；
- 所有拒绝决策返回稳定错误码和可审计原因，不泄露敏感资源存在性。

## 17. 验收门槛

ECP 达到 G0 必须同时满足：

1. 一个企业部署一套 ECP 并同时注册至少两个模拟产品实例；
2. 用户通过 Casdoor 登录一次后可访问已授权产品，但不能访问未授权产品；
3. ecp-ui 使用同一套 React + Ant Design + Tailwind CSS + Vite 页面管理不同产品成员、固定角色和服务账号；Ant Design 与 Tailwind 职责边界、无 Preflight 和主题 Token 约束通过自动化检查；
4. 产品 Connector 只能查询和操作自己的资源命名空间；ecp-api 机器身份不能代替 Actor 授权，未授权管理员不能发现资源名称，高风险写入通过 Resource Version 变化测试；
5. 任一 Connector Credential 泄露时不能调用 Casdoor 管理 API、OIDC Code Exchange、其他产品或其他实例；
6. `ecp-ui` 和每个产品实例使用独立 OIDC Client，精确 Redirect URI、Secret 轮换、生产禁用 DCR 和开放重定向测试通过；
7. control-managed 与 directory-managed Group 的增删、同步、角色绑定和审计符合本 Spec；
8. ecp-ui 发起禁用后立即形成产品拒绝覆盖；身份同步健康时，外部 Casdoor/目录停用在 5 分钟内发现；同步不健康时在同一新鲜度上限内转为 stale 拒绝；在线 Connector 在 60 秒内获得新的 Lifecycle/Identity Sync Version；
9. Casdoor/Casbin 通过资源继承、显式覆盖、批量决策和隔离验证；
10. 产品策略保留命名空间、写后读校验、漂移发现、全部Allow失效、规范化Diff和重新认证修复流程通过验证；
11. Web、HTTP、MCP 和机器身份使用同一授权顺序；blocked/pending Principal、禁用服务身份及Group继承不能绕过拒绝覆盖；
12. 关键身份、授权、凭据和产品操作进入统一审计且完成脱敏；
13. Schema Owner、Control Transaction Writer、Audit Ingest Writer/Reader/Maintainer 的凭据隔离与权限、业务变更与Change-Committed事件原子性、禁止在线更新删除、归档Manifest和恢复校验通过PostgreSQL/MySQL验证；
14. PostgreSQL 和 MySQL 均通过建库、迁移、升级和集成验证；
15. Casdoor、ECP 及产品数据完成一次协调备份和空环境恢复；
16. 单产品故障不会导致其他产品和全局管理页面不可用；
17. `ecp-api` 和 Casdoor 故障符合默认拒绝与受限缓存策略；身份同步超过 5 分钟后，人类及 Group 相关访问以 `identity_state_stale` 拒绝，旧 Allow 不得续期，恢复前完成增量或全量对账；
18. 产品接入不需要复制 `ecp-api` 或 `ecp-ui` 代码；
19. JIT通过非可信Issuer、未验证邮箱、未映射Group和跨Provider同邮箱冲突测试，均不能自动获得业务资源权限；
20. 只复制 `ecp/` 到干净目录后，server、SDK、UI、契约生成、双数据库测试和 Compose 仍可独立通过；当前单仓中 ApiMind 通过根 `go.work` 消费 SDK 且没有本地 `replace`；未来拆仓前，正式 SDK 版本必须在 `GOWORK=off` 的干净 module 中从规范仓库解析并通过 checksum/编译/测试，ApiMind 移除根工作区 ECP `use` 项后无需修改 import path；
21. Ed25519 Delegation 与审计归档密钥完成初始 fingerprint pin、KeySet 单调版本、Connector acknowledgement、离线降级、轮换、紧急撤销、未知 `kid`、重放、历史归档验签和带外泄露恢复测试。

## 18. Gate 0：实施前验证与输入冻结

以下问题必须在任何生产代码脚手架、数据迁移或 ApiMind 集成开始前，通过可重复原型或真实环境验证。结果写入版本化验证报告并附测试命令、输入版本、规模、原始结果和结论；“需要验证”不是可带入 Gate A 的待办项：

- Casdoor/Casbin 对目标资源数量和策略数量的性能；
- restricted resource、角色覆盖和 owner recovery 的模型表达；
- Casdoor用户与策略变更事件能力、增量轮询键及其在目标版本中的可靠性；
- Casdoor Group 的稳定标识、管理 API、目录同步和删除语义；
- Casdoor升级对 Organization、Application、Role 和 Permission API 的兼容性；
- PostgreSQL/MySQL 在唯一约束、时间精度和迁移回滚上的共同实现；
- Product Manifest 和 Connector N/N-1 版本兼容边界；
- 基础短暂停写窗口能否形成 Casdoor、ECP 和产品数据的协调备份，并完成空环境恢复；
- 条件性能力判定：SIEM/不可变 Sink、外部 Secret Manager、HA、SCIM 和在线一致性快照是否由首批目标企业强制要求。

Gate 0 还必须冻结 `versions.lock.yaml`：Go/go-zero/goctl/goctl-swagger/GORM/迁移库、Node/npm/React/Ant Design/Tailwind/Vite、Casdoor、PostgreSQL 和 MySQL 的精确版本、官方来源与 checksum/digest。初始验证基线为官方 `casbin/casdoor:3.154.4@sha256:95c7be68fb98daf2ec74a10c9f785af1ef75e8fef6dd4aad455a899e651e87e2`、官方 `postgres:17.6@sha256:00bc86618629af00d2937fdc5a5d63db3ff8450acf52f0636ec813c7f4902929` 与官方 `mysql:8.4.6@sha256:869218921e61d6c3c89820955d63cca42971f0e3e6c1e2792247bbd944ebc6e9`；若 Gate 0 证明基线不满足要求，必须先更新 Spec 与锁文件并重新验证，不使用浮动标签。

G0 明确接受以下受限范围，且不得在产品文案中扩大解释：首个目标企业尚未提供容量画像前，Gate 0 只证明单次 100 决策批量授权的语义和基线延迟，不承诺持续吞吐或最大策略规模；Casdoor 变更同步采用可对账的增量轮询，不依赖未验证的事件投递；只验证锁定版本的重启与数据恢复，跨版本升级必须在实际升级前单独重跑 N/N-1 验证。G0 采用单 ECP 实例、短暂停写协调备份、可注入的外部 Secret 引用和可导出的审计流；不内置 HA、SCIM、Secret Manager、SIEM 或在线一致性快照。这些能力一旦成为目标企业的强制采购条件，必须先升级为硬验收项，不得继续沿用 `accepted_limit`。

Gate 0 的硬退出条件：上述每项都有 `pass` 或经本 Spec 明确缩减范围后的 `accepted_limit`，并且只包含锁文件、工具模块和验证原型的 ECP Gate 0 bundle 可以在干净目录运行，双数据库迁移原型、Casdoor/Casbin 语义原型和 N/N-1 契约原型全部通过。任何必需项为 `fail`、`unknown` 或缺少证据时，不得进入 Gate A；应先修订本 Spec、依赖锁或 G0 范围。完整 server、SDK、UI 和 Compose 的 ECP-only 构建只能在相应工件完成后执行，并作为 Gate D 与最终验收的硬门槛，不能由 Gate 0 提前宣称。

## 19. 参考标准与官方资料

- [OpenID Connect Core 1.0](https://openid.net/specs/openid-connect-core-1_0-18.html)
- [SCIM Core Schema RFC 7643](https://www.rfc-editor.org/info/rfc7643/)
- [SCIM Protocol RFC 7644](https://www.rfc-editor.org/info/rfc7644/)
- [NIST SP 800-63B](https://pages.nist.gov/800-63-4/sp800-63b.html)
- [Casdoor User and Organization](https://casdoor.org/docs/user/overview/)
- [Casdoor Shared Application](https://casdoor.org/docs/application/shared-application/)
- [Casdoor Permission Configuration](https://casdoor.org/docs/permission/permission-configuration/)
- [Casdoor Exposed Casbin APIs](https://casdoor.org/docs/permission/exposed-casbin-apis/)
- [Casdoor Deployment](https://casdoor.org/docs/category/deployment/)

## 20. 成功定义

ECP 成功不是因为拥有通用后台，而是因为：

- 一个企业只需部署和学习一套企业控制台；
- 多个产品共享身份和治理能力，但权限和业务数据保持隔离；
- 新产品通过 Connector 和 Manifest 接入，不复制企业基础设施；
- Casdoor成熟能力被直接复用，同时产品语义、审计和运维责任清晰；
- 企业能够安全安装、授权、追责、备份、恢复和退出。
