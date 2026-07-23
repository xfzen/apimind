# 架构

[English](architecture.en.md)

```text
浏览器 / 自动化客户端 / Codex
              |
       OpenAPI / MCP / HTTP
              |
      ApiMind Server
              |
          MongoDB
```

ApiMind Server 是 Headless/API-first Runtime Core。Web 和 Skills 都是独立客户端，不拥有认证、业务数据或存储。

## 仓库与发布边界

| 路径 | 源码管理 | 发布关系 |
| --- | --- | --- |
| `web/` | 本仓库直接维护 | 随 ApiMind 统一工作区验证与发布 |
| `skills/` | 本仓库直接维护 | 随 ApiMind 统一工作区验证与发布 |
| `server/` | 独立公开仓库，本仓库固定其提交 | Server 保持独立版本、历史与许可证 |

固定 Server 提交让一次 ApiMind 发布可以复现，同时保持 Server 与 Web、Skills 的独立发布节奏。

当前 HTTP 兼容路由是 `/api/*`。OpenAPI 位于 Server 的 `api/openapi/v1/openapi.yaml`，采用 OpenAPI 3.0.3；MCP 契约位于 `api/mcp/v1/`。这里的 `v1` 是契约制品版本，不表示已经实现 `/api/v1/*` 路由。详细生命周期规则以 [Server API Versioning](https://github.com/xfzen/apimind-server/blob/dev/API-VERSIONING.md) 为准。

多协议、通用 Proxy、Scenario、E2E、回放、External Handler、SDK 生成、Arazzo、OpenAPI 3.1/3.2、路由分层和 PostgreSQL 是 Roadmap。
