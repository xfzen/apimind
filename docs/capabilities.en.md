# Capability Matrix

[中文](capabilities.md)

| Server capability | Web entry | Skills/MCP entry | Public contract | Status |
| --- | --- | --- | --- | --- |
| YApi-compatible project, interface, and documentation HTTP APIs | project, interface, and documentation screens | `apimind-contract` | `/api/*`, OpenAPI 3.0.3 | Current |
| HTTP Mock | Mock screens | related interface contracts can be read | `/mock/*` and Server contracts | Current |
| Test-collection execution | collection screens | discoverable through MCP HTTP | Server HTTP/OpenAPI | Current |
| MCP HTTP | no dedicated Web entry | `apimind-mcp-v1` | `api/mcp/v1/` | Current |
| MongoDB | no direct entry | no direct entry | Server configuration | Current |
| TCP/WebSocket/MQTT/gRPC | none | none | none | Roadmap |
| Generalized Proxy/Scenario/E2E/replay/External Handler | none | none | none | Roadmap |
| SDK generation, Arazzo, PostgreSQL | none | none | none | Roadmap |

`/api/*` is the current HTTP compatibility surface; artifact `v1` does not mean `/api/v1/*`. See [Server API Versioning](https://github.com/xfzen/apimind-server/blob/dev/API-VERSIONING.en.md).
