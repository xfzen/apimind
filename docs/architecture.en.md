# Architecture

[中文](architecture.md)

```text
Browser / automation clients / Codex
                  |
           OpenAPI / MCP / HTTP
                  |
          ApiMind Server
                  |
              MongoDB
```

ApiMind Server is the Headless/API-first Runtime Core. Web and Skills are independent clients and do not own authentication, business data, or storage.

## Repository and release boundaries

| Path | Source ownership | Release relationship |
| --- | --- | --- |
| `web/` | Maintained directly in this repository | Verified and released with the unified ApiMind workspace |
| `skills/` | Maintained directly in this repository | Verified and released with the unified ApiMind workspace |
| `server/` | Independent public repository pinned here | Retains its own versions, history, and license |

Pinning a Server commit makes an ApiMind distribution reproducible while
preserving independent release cadences for Server, Web, and Skills.

The current HTTP compatibility surface is `/api/*`. OpenAPI is published at `api/openapi/v1/openapi.yaml` using OpenAPI 3.0.3, and MCP contracts are under `api/mcp/v1/`. Artifact `v1` does not mean that `/api/v1/*` routes exist. See [Server API Versioning](https://github.com/xfzen/apimind-server/blob/dev/API-VERSIONING.en.md) for lifecycle rules.

Multi-protocol support, generalized Proxy, Scenario, E2E, replay, External Handler, SDK generation, Arazzo, OpenAPI 3.1/3.2, route-layer separation, and PostgreSQL are Roadmap.
