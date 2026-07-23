# 能力矩阵

[English](capabilities.en.md)

| Server 能力 | Web 入口 | Skills/MCP 入口 | 公开契约 | 状态 |
| --- | --- | --- | --- | --- |
| YApi 兼容项目、接口与文档 HTTP API | 项目、接口、文档页面 | `apimind-contract` | `/api/*`、OpenAPI 3.0.3 | 当前 |
| HTTP Mock | Mock 页面 | 可读取相关接口契约 | `/mock/*` 与 Server 契约 | 当前 |
| 测试集合执行 | 测试集合页面 | MCP HTTP 可发现能力 | Server HTTP/OpenAPI | 当前 |
| MCP HTTP | 无专用 Web 入口 | `apimind-mcp-v1` | `api/mcp/v1/` | 当前 |
| MongoDB | 无直接入口 | 无直接入口 | Server 配置 | 当前 |
| TCP/WebSocket/MQTT/gRPC | 无 | 无 | 无 | Roadmap |
| 通用 Proxy/Scenario/E2E/回放/External Handler | 无 | 无 | 无 | Roadmap |
| SDK 生成、Arazzo、PostgreSQL | 无 | 无 | 无 | Roadmap |

`/api/*` 是当前 HTTP 兼容面；契约目录中的 `v1` 不等于 `/api/v1/*`。生命周期规则见 [Server API Versioning](https://github.com/xfzen/apimind-server/blob/dev/API-VERSIONING.md)。
