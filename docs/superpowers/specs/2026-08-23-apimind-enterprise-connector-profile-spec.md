# ApiMind Enterprise Connector Profile

**状态：** 已确认

**日期：** 2026-08-23

**范围：** ApiMind 接入 Enterprise Control Plane（ECP）的产品需求、资源权限模型、兼容边界与技术契约；不包含实施排期和任务拆分

**上位设计：** [ECP Requirements & Technical Design](2026-08-23-enterprise-control-plane-spec.md)

## 1. 决策摘要

ApiMind 是 ECP 的第一个接入产品，不拥有专属 `ecp-api` 或专属 `ecp-ui`。

ApiMind 侧只增加一个 Connector 边界：

```text
Existing ApiMind Web
       │
Existing ApiMind Go Service + ApiMind ecp-connector
       │
ECP + ecp-ui + Casdoor
```

核心决策：

1. 现有 YApi Web 不做大规模改造；
2. 现有 Go 服务继续拥有 workspace、project、cat、interface 和文档业务；
3. ApiMind `ecp-connector` 作为现有 Go 服务内的适配边界，不另建一套 ApiMind 企业服务；
4. 企业用户、产品会话、权限决策、服务身份和统一审计接入 ECP；
5. 企业身份和 Casbin 策略由 Casdoor 承担；
6. 现有 YApi MongoDB 与所有新增企业关系数据严格分库；
7. 旧 YApi 用户、成员角色和 Log 只作为兼容数据，不再作为企业身份、授权和审计事实来源；
8. Web、HTTP API、MCP 和后续 Runner 必须使用同一授权决策；
9. 成员和角色管理迁移到 `ecp-ui`，旧 Web 仅保留入口和必要展示；
10. 实例管理员不因管理部署而自动获得全部工作区和项目业务数据。

## 2. 当前基础与风险

当前代码已经具备可接入基础：

- Go Server、Web 和 MongoDB 的自托管运行形态；
- `workspace / project / cat / interface` 核心业务层级；
- YApi 兼容用户与 `owner/dev/guest` 成员数据；
- Web 登录、LDAP 兼容入口和用户列表页面；
- MCP Contract Token 哈希存储和基础请求上下文；
- 项目业务 Log 和部分契约写入记录。

当前实现不能被视为企业门槛已经完成：

- 用户身份仍以 YApi 兼容 User 和旧会话为主；
- LDAP 开关和路由存在不等于真实企业目录生命周期已闭环；
- 多数业务路径尚未统一到一个产品授权入口；
- 部分兼容返回值仍使用固定角色，不能作为真实权限证据；
- `owner/dev/guest` 无法完整表达已确认的 workspace/project 角色；
- 当前 MCP Scope 主要校验请求中的 project ID，不足以证明调用者已获项目授权；
- 当前 Log 是可变的项目业务动态，不是企业追加式审计。

以上判断必须在实施 Spec 前再次以当前代码和运行行为核对；无法确认的内容标记为“需要验证”。

## 3. 产品资源模型

### 3.1 业务层级

ApiMind 保持已有层级，不新增组织业务层：

```text
workspace（兼容 YApi group）
  └── project
       ├── cat
       │    └── interface
       └── document / workspace documentation
```

首期 ACL 只落在 workspace 和 project：

- cat、interface 和 Markdown document 继承 project；
- 不提供接口级、分组级和文档级独立 ACL；
- 资源可作为审计目标，但不能形成独立授权事实来源；
- 已有“工作区文档”项目继续是普通 project 的一种产品形态，使用相同项目权限。

### 3.2 项目访问模式

每个项目具有一种访问模式：

- `workspace`：默认值，继承 workspace 角色；
- `restricted`：普通成员必须获得显式 project 角色。

项目创建默认使用 `workspace`。企业或 workspace 策略可以要求新项目默认 `restricted`。

## 4. 固定角色与继承

### 4.1 实例角色

| 角色 | 能力边界 |
| --- | --- |
| `instance_admin` | 部署配置、身份接入、产品注册、安全策略、备份与恢复；不自动读取业务项目 |
| `security_auditor` | 只读查询和导出授权范围内的企业审计；不能修改业务数据和权限 |

### 4.2 Workspace 角色

| 角色 | 主要能力 |
| --- | --- |
| `owner` | workspace 治理、成员、项目恢复和所有权接管 |
| `admin` | 日常 workspace 管理和成员管理，不可移除最后 owner |
| `member` | 按项目访问模式获得工作权限 |
| `guest` | 默认只读访问 workspace 模式项目 |

### 4.3 Project 角色

| 角色 | 主要能力 |
| --- | --- |
| `admin` | 项目设置、成员、Token、导入导出和内容管理 |
| `editor` | 编辑接口、分组和文档；不能管理成员和高风险配置 |
| `viewer` | 只读查看允许的数据 |

### 4.4 继承规则

`workspace` 模式项目按以下规则继承：

| Workspace 角色 | 默认 Project 角色 |
| --- | --- |
| `owner` | `admin` |
| `admin` | `admin` |
| `member` | `editor` |
| `guest` | `viewer` |

规则约束：

- Workspace 和 Project 角色可以绑定内部 Principal 或已映射的企业 Group；
- Group 成员关系由 Casdoor/ECP解析，ApiMind 不复制和维护另一套 Group；
- 显式 project 角色优先，可提升或降低继承角色；
- `restricted` 项目中，member/guest 无显式 project 角色时拒绝访问；
- workspace owner 保留恢复和治理能力，避免孤立项目；
- workspace admin 不自动绕过 restricted project；
- 禁止通过 cat、interface、document 或旧 API 绕过 project 决策。

## 5. Product Manifest

ApiMind 首期 Manifest 至少声明：

```yaml
apiVersion: ecp/v1
product: apimind
displayName: ApiMind

resourceTypes:
  - workspace
  - project
  - cat
  - interface
  - document

accessRoots:
  - workspace
  - project

roles:
  instance: [instance_admin, security_auditor]
  workspace: [owner, admin, member, guest]
  project: [admin, editor, viewer]

projectAccessModes: [workspace, restricted]

capabilities:
  resourceDirectory: true
  serviceAccounts: true
  auditIngestion: true
  publicSharingPolicy: true
  exportPolicy: true
```

动作目录至少覆盖：

- 实例与安全：`instance.manage`、`audit.read`、`audit.export`；
- Workspace：`workspace.read`、`workspace.manage`、`workspace.member.manage`；
- Project：`project.read`、`project.write`、`project.manage`、`project.member.manage`；
- 内容：`interface.read/write/delete`、`document.read/write`、`contract.import/export`；
- 暴露：`share.manage`、`public.read`；
- 凭据：`service_account.manage`、`token.manage`、`secret.use/manage`。

动作最终清单和现有 API 映射标记为“需要验证”，不能仅按页面菜单推断。

## 6. 身份与用户映射

```text
Casdoor Organization/User UUID
            │
            ▼
Enterprise Control Principal
            │
            ▼
legacy YApi user_id
```

约束：

- 内部 Principal 使用稳定 ID；
- `legacy_yapi_user_id` 是显式映射，不要求与 Principal ID 相同；
- 邮箱、用户名和 DN 不作为跨系统主键；
- 旧 User 文档保留用于兼容展示、作者归属和历史数据；
- 企业模式下 Casdoor 和 ECP 是账号状态事实来源；
- 用户禁用后保留旧 YApi 作者记录，但所有新会话和个人 Token 按 ECP 撤销时限失效；
- 自动邮箱绑定只允许上位Spec定义的受信任Issuer、verified email和一次性邀请首次绑定，不用于普通账号合并或跨Provider合并。

## 7. 登录与会话兼容

### 7.1 正式入口

ApiMind Web 登录页只做最小调整：

- 提供同源 `/api/enterprise/auth/start` 入口并跳转 Casdoor；
- Casdoor 只回调 ApiMind 同源 `/api/enterprise/auth/callback`；
- ApiMind产品实例使用独立Casdoor OIDC Client，生产Redirect URI必须精确等于该实例已验证Canonical Base URL下的回调地址，不接受通配符和请求参数覆盖；
- ApiMind Go 服务通过 `ecp-connector` 使用短时一次性 `login_transaction` 与 `ecp-api` 交换结果，再由 ApiMind 域名设置 HttpOnly 产品会话 Cookie；
- Header 中企业管理入口跳转 `ecp-ui`；
- 退出撤销产品会话，并按用户选择决定是否退出企业 SSO。

### 7.2 旧接口

- `enterprise.enabled=false` 时保持当前社区模式登录；`enterprise.enabled=true` 时企业会话是唯一正式会话，开放注册、LDAP 登录入口和本地密码登录默认关闭；
- 旧 `/api/user/login` 和旧 JWT/Cookie 仅可在显式 `enterprise.legacy_auth_compat=true` 的迁移窗口内作为兼容，不得自动回退；
- 不使用不安全的用户名密码代理调用 Casdoor；
- 兼容窗口内可同时签发产品会话和兼容 Cookie，但每次使用旧会话都记录审计并返回弃用标识；旧会话不能获得 ECP 已拒绝的权限，也不能延长 Identity Freshness Deadline；
- 兼容窗口最长跨一个已发布 ApiMind minor 版本且默认 30 天，取更早者；进入窗口前必须完成旧用户到 Principal 的映射、活跃会话盘点和回滚方案；
- 移除条件为连续 14 天无旧会话成功使用、全部活跃用户已映射、自动化与人工验收通过。到期后服务拒绝旧会话并删除 Web 入口；不是删除历史 User 文档；
- 迁移与回滚都必须覆盖登录、登出、Cookie 冲突、双会话权限不一致、已禁用用户、撤销、MCP/Token 和跨实例隔离测试；
- `ecp-ui` 不使用旧会话；
- ApiMind 产品会话不与 `ecp-ui` Cookie 跨域复用；
- 开放注册在企业模式下默认关闭。

### 7.3 会话验证

现有 Go 服务通过 ApiMind `ecp-connector` 解析产品会话并获得 Principal。身份解析必须成为统一请求上下文，不能继续只在少数 Handler 中临时调用。

## 8. 最小侵入集成边界

现有 YApi Web 不进行路由、状态管理或业务页面重写。必要变更集中在：

1. 登录和退出入口；
2. Header 的统一企业控制台入口；
3. 旧成员管理入口跳转 `ecp-ui`；
4. 对拒绝原因和会话失效的统一提示。

现有 Go 服务在 `server/internal/ecp` 增加集中式适配，并通过 `server/api/internal/svc/ServiceContext` 装配：

- `Client`：封装 ECP 会话、授权、审计和生命周期 HTTP 契约；
- `PrincipalResolver`：把产品会话转换为统一 Principal；
- `Authorizer`：唯一产品授权入口；
- `AuditEmitter`：标准事件与本地 Outbox；
- `ResourceProvider`：向 ECP 返回 workspace/project 摘要和层级；
- `CompatibilityProjector`：维护旧 YApi 展示数据。

ApiMind `server/go.mod` 只依赖公开 module `github.com/xfzen/ecp/sdk/go` 的明确版本，并从 `connector/v1` 使用 wire types、错误码、签名验签和 typed client。当前同仓开发由根 `go.work` 解析本地 `ecp/sdk/go`；不得在 `go.mod` 提交本地 `replace`，不得导入 `ecp/server/internal`，也不得复制 SDK 协议代码。ECP 后续独立提交或拆仓时 ApiMind import path 不变，只更新已发布 SDK 版本。

ApiMind HTTP 契约仍以 `server/docs/apimind.api` 为唯一 goctl 入口；企业登录和 Connector 路由的请求/响应类型进入 `server/docs/apis/enterprise.api`，生成继续使用现有 `server/scripts/genapi.sh` 和 `server/scripts/gencontracts.sh`，不得手写 `server/api/internal/handler/routes.go` 或 `server/api/internal/types/types.go`。

最小改动不等于保留两套授权。所有安全决策必须收口到统一入口，即使这要求调整现有 Handler 或服务边界。

收口范围以实际入口清单为准，而不是仅修改少量 `internal/service` 包。当前直接访问 Repository 的 go-zero Logic、HTTP Handler、MCP、Mock、导入导出、契约同步、文档操作和后台任务都必须逐项登记 actor/action/resource 解析方式并接入同一 Authorizer。Logic 可以保持薄层，但在完成业务服务迁移前不能被误判为已覆盖；任何未分类的受保护入口使企业模式验收失败。

## 9. Connector 资源接口

ApiMind `ecp-connector` 对 ECP 提供：

### `SearchResources`

按类型、名称和父级搜索 workspace/project。ApiMind `ecp-connector` 必须验证 `ecp-api` 机器凭据和短期 Delegation，并使用其中的 Actor Principal 与 Requested Action 调用统一 Authorizer；返回结果只能包含该 Actor 有权管理的资源：

- ID；
- 名称；
- 类型；
- 父资源 ID；
- 状态；
- 必要的访问模式；
- 产品深链接。

`instance_admin` 没有对应 Workspace/Project 业务权限时，不能通过该接口发现项目 ID、名称或存在性。系统健康检查不复用资源搜索权限。

### `ResolveResource`

在验证 Actor 资源权限后确认资源存在性并返回稳定摘要和 `resource_version`，不返回接口内容和文档正文。资源父级、项目访问模式或授权根变化必须改变版本；无权限时不能通过错误差异泄露资源是否存在。

### `GetResourceAncestry`

返回授权所需层级，例如：

```text
interface:300 → cat:200 → project:100 → workspace:10
```

同时返回整个授权层级的 `resource_version`。版本可以由持久化版本号或稳定规范化 Hash 产生，但不能只使用客户端提交时间。

### `ApplyCompatibilityProjection`

把 ECP 成员变化投影为旧 Web 所需的最小 YApi 成员数据。该投影只用于兼容显示，不得参与最终授权。

## 10. 旧成员角色兼容

首次导入使用明确、保守映射：

| 旧作用域 | 旧角色 | 新角色 |
| --- | --- | --- |
| workspace/group | `owner` | workspace `owner` |
| workspace/group | `dev` | workspace `member` |
| workspace/group | `guest` | workspace `guest` |
| project | `owner` | project `admin` |
| project | `dev` | project `editor` |
| project | `guest` | project `viewer` |

反向投影可能丢失 `workspace admin`、显式覆盖和 restricted 项目等语义，因此：

- `ecp-ui` 是成员与角色的唯一管理入口；
- 旧成员页面不得继续写入企业角色；
- 旧成员列表可以显示兼容摘要和前往企业控制台的链接；
- ECP 角色不能从旧 MongoDB 成员字段反向覆盖；
- 反向投影的精确展示策略标记为“需要验证”。

## 11. 授权执行

### 11.1 请求流程

```text
Authenticate Product Session
  → Resolve Principal
  → Check Principal Access State, Lifecycle Version and Identity Freshness
  → Load Resource Ancestry
  → Authorize with Resource Version
  → Audit Intent when required
  → Recheck Authorized Resource Version
  → Execute Business Operation
  → Audit Outcome
```

只有 active Principal 才能进入 Casbin判断；blocked、pending_external_sync、撤销会话、禁用Credential和 stale Identity Sync 都必须在直接角色或Group继承之前拒绝。对于资源移动、父级变化、project access mode 变化和高风险写入，提交前版本不一致必须终止当前操作并重新加载层级与授权，不能继续使用旧决策。普通只读请求可以接受同时绑定Lifecycle/Identity Sync/Policy/Resource Version且未越过Identity Freshness Deadline的缓存；ecp-api或Casdoor不可用时不得在本地续期。

### 11.2 强制入口

以下入口必须使用同一授权语义：

- Web 发起的现有 `/api/*`；
- 新增或兼容 HTTP API；
- MCP Contract Tools；
- 导入、导出和批量写入；
- Mock、测试和请求执行；
- 后续 Runner、Worker、定时任务和 Agent。

前端按钮可见性只能改善体验，不能代替后端授权。

### 11.3 MCP 与机器身份

- 现有 Contract Token 迁移为ECP管理的 Service Principal；
- Token 必须绑定 ApplicationInstance、Project 和允许的 Action；
- 仅验证 project ID 大于零不构成授权；
- MCP 请求使用与 Web 相同的 Authorizer；
- Token 轮换或撤销后旧 Token 不能开始新操作；
- 开发模式绕过不得进入生产配置。

## 12. 数据暴露与Secret

### 12.1 默认策略

- 项目和工作区文档默认私有；
- 企业可以实例级禁止公开分享；
- restricted 项目不能通过公开接口、旧接口或导出旁路暴露；
- 导入、导出、批量下载和分享使用独立 Action；
- 企业启用前扫描已有公开资源并要求管理员确认处置。

### 12.2 Secret

- Token、密码、Cookie、证书私钥和环境 Secret 不得进入普通项目字段；
- Web、日志、错误、审计、导出和测试报告统一脱敏；
- Secret 使用只授予执行权限，不等于允许读取明文；
- 后续 Environment/Auth/Network 能力必须复用同一 Secret Reference。

## 13. ApiMind 审计 Profile

旧 YApi Log 继续作为业务动态；企业审计写入共享 `audit_event`。

ApiMind 必须上报：

- 登录、失败、退出和会话撤销；
- Workspace/Project 创建、归档、删除和接管；
- 成员、角色、访问模式和公开策略变化；
- Interface、Cat、Document 的关键创建、更新和删除；
- 导入、导出、批量写入和契约同步；
- 服务账号、Token 和 Secret 操作；
- MCP、Runner、CI 和 Agent 写入；
- 被拒绝的高风险操作；
- 备份、恢复和升级。

审计差异使用字段允许列表并统一脱敏。接口和文档正文不默认完整复制到审计数据库。

## 14. 数据库与事务边界

```text
YApi MongoDB
  workspace/project/cat/interface/document/legacy user/log

ecp_db（PG/MySQL）
  mapping/session/manifest/audit/outbox/security config

Casdoor DB（PG/MySQL）
  organization/user/application/role/permission/session
```

- 三者独立 database；
- ApiMind 只通过 `ecp-connector` API 访问 ECP；
- 不直接访问 Casdoor；
- `ecp-api` 不读取 YApi MongoDB；
- 即使未来 YApi 迁移到 PostgreSQL/MySQL，仍使用独立 database；
- 不使用跨库事务。

涉及 YApi 数据的高风险写入：

```text
写入 Audit Intent
  → 修改 YApi 数据
  → 写入 Audit Outcome
```

成员兼容投影使用 operation ID 和 Outbox 重试，不反向改变授权事实。

## 15. ecp-ui 中的 ApiMind 视图

`ecp-ui` 根据 Manifest 为 ApiMind 提供：

- ApiMind产品实例及健康；
- 用户和用户组的ApiMind成员关系；
- Workspace/Project资源选择；
- 固定角色和 restricted 项目管理；
- 服务账号和 Project Token；
- 公开分享和导出策略；
- ApiMind审计筛选；
- Connector、产品和数据库备份状态。

这些页面属于 `ecp-ui`，不在 ApiMind Web 中复制实现。接口编辑、文档编辑、Mock、测试等业务配置继续留在 ApiMind Web。

这些 ApiMind 管理视图复用 ECP Spec 规定的 React + Ant Design + Tailwind CSS + Vite 技术栈和组件边界；ApiMind 只提供 Manifest、Connector 数据和深链接，不提供专属前端组件或运行时代码。

## 16. 故障行为

| 故障 | ApiMind 行为 |
| --- | --- |
| Casdoor 不可用 | 禁止新登录；人类及 Group 相关的已有 Allow 最多使用到既有 Identity Freshness Deadline，进入 stale 后全部拒绝且不得续期 |
| ecp-api 不可用 | 权限管理和高风险写入拒绝；低风险读取只能使用未越过Identity Freshness Deadline且版本仍有效的既有缓存，禁止本地续期 |
| ApiMind Connector 不可用 | ecp-ui 中 ApiMind 页面只读或不可用；其他产品不受影响 |
| Audit Ingestion 不可用 | 高风险操作拒绝；允许的普通事件进入 ApiMind 本地 Outbox |
| YApi MongoDB 不可用 | Connector 不推测资源存在性，ecp-ui 显示产品故障 |

## 17. 验收场景

ApiMind Connector G0 必须通过：

1. 新企业通过 Casdoor登录，无需使用旧 YApi 密码；
2. 旧用户可稳定映射到原 YApi作者和成员记录；
3. ecp-ui 可以管理 ApiMind Workspace/Project 权限；
4. 用户组可以绑定 Workspace/Project 角色，目录组变化按 ECP 规则生效；
5. workspace继承、restricted项目、显式覆盖和owner recovery符合本Spec，资源在授权后移动时旧Resource Version不能完成高风险写入；
6. 实例管理员无法因管理部署而直接读取未授权项目；
7. Web、HTTP、MCP 使用同一授权结果；
8. 旧接口不能绕过新权限；
9. 用户禁用后的 Principal Access State、Lifecycle Version、产品会话和个人 Token 在 ECP 承诺时限内生效，历史作者信息保留；Identity Sync 超过 5 分钟后人类及 Group 相关访问拒绝，旧 Allow 不得续期，对账完成前不能恢复；
10. Project Token 只能访问显式授权项目和动作；
11. 公开分享、导出和Secret策略可以实例级关闭；
12. 身份、授权、Token、导入导出和关键写入进入统一审计；
13. 旧 Web 核心接口与文档业务流继续工作；
14. 旧成员数据只是兼容投影，不影响最终授权；
15. YApi、ECP 和 Casdoor 完成协调备份及空环境恢复；
16. ApiMind 接入没有复制 `ecp-api` 和 `ecp-ui` 代码。

## 18. 非目标

- 不重写当前 YApi Web；
- 不把 ecp-ui 嵌入为微前端；
- 不增加 cat/interface/document 独立 ACL；
- 不建设自定义角色编辑器；
- 不用邮箱替换内部稳定用户映射；
- 不把 Casdoor管理员等同为ApiMind数据管理员；
- 不直接修改 YApi、Casdoor 或 ECP 数据库完成迁移和运维；
- 不在本 Spec 中建设 Contract Sync、复杂审批、SIEM、HA 或 SaaS 多租户；
- 不在本 Spec 中编写实施阶段、排期和任务拆分。

## 19. ApiMind Gate 0 验证

以下项目进入上位 ECP Spec 的 Gate 0 与实施计划 Task 0。授权入口清单、登录切换、凭据迁移、资源可见性、规模、Outbox 和撤销边界未形成可重复证据前，不得开始 ApiMind Connector 生产实现：

- 当前所有写接口、导入导出、Mock、测试和 MCP 的完整授权入口清单；
- 旧 Web 登录页切换 OIDC 的最小兼容改动；
- 旧 YApi 密码哈希能否通过 Casdoor官方方式安全迁移；
- 旧成员页面改为只读摘要后对核心使用流的影响；
- 现有 public/private 项目和公开文档的迁移策略；
- 目标企业规模下 Workspace/Project 资源目录和 Casbin 策略性能；
- 当前 Contract Token 到 Service Principal 的迁移和撤销边界；
- ApiMind 本地 Outbox 的持久化位置和故障恢复；
- 旧 Log、企业 Audit 和资源历史之间的产品展示边界；
- YApi未来迁移到 PostgreSQL/MySQL 时保持独立 database 的成本与必要条件。

每项必须在 `docs/test-reports/ecp-g0-feasibility.md` 中获得 `pass` 或经本 Spec 明确缩减后的 `accepted_limit`。不迁移旧密码哈希是允许的安全结论，但必须形成明确方案：要求用户通过 Casdoor 邀请/重置建立新凭据，不能以未知为由保留无期限旧密码回退。任何 `fail`、`unknown` 或缺少入口清单都阻塞 Gate A。

## 20. 成功定义

ApiMind Enterprise Connector 成功意味着：

- ApiMind 无需拥有自己的 `ecp-api` 和 `ecp-ui`；
- 旧 Web 保持核心业务稳定，同时所有安全入口被统一治理；
- 企业可以用共享身份、统一后台和统一审计管理ApiMind；
- ApiMind 业务数据继续独立，ECP 无法越界读取；
- 后续产品可以复用同一平台，而不是重复一次ApiMind的企业化工程。
