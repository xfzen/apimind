# ApiMind Skills Plugin

[中文](README.md)

## Overview

ApiMind Skills is a standalone Codex plugin package for configuring repository-local ApiMind project mappings and safely reading or maintaining API contracts through MCP. It contains no Server, Web, application, database-access, or business code.

## Included Skills

| Skill | Capabilities | Typical request |
| --- | --- | --- |
| [`apimind-project-config`](skills/apimind-project-config/SKILL.md) | Initialize or review repository-local `AGENTS.md`, optional `CLAUDE.md`, and root `apimind-contract.yaml`; bind an ApiMind workspace and project; maintain optional interface-to-cat routing hints | “Configure this repository for ApiMind using workspace `my-team` and project `my-api`.” |
| [`apimind-contract`](skills/apimind-contract/SKILL.md) | Query workspaces, projects, cats, and interfaces through ApiMind MCP; review API contracts; create or update cats and interfaces only after an explicit request and confirmation | “Review whether this API matches ApiMind” or “Update this interface in ApiMind.” |

Every write requires an explicit user request and the Skill confirmation flow. The plugin does not access the database directly or delete ApiMind resources.

## Quick Start

### Install in Codex App

ApiMind is distributed as a Codex plugin. The general installation flow is:

1. Open **Plugins** in Codex App.
2. Add or select the ApiMind marketplace provided by `xfzen/apimind`.
3. Install **ApiMind** from that marketplace.
4. Restart Codex App after installation or upgrade, then use the Skills in a new task.

You can also register the GitHub repository as a Codex marketplace from a
terminal, then complete installation from the **Plugins** page in Codex App:

```sh
codex plugin marketplace add xfzen/apimind
```

The repository-root `.agents/plugins/marketplace.json` exposes `skills/` as
the ApiMind plugin. To use a version that has not reached the default branch,
add `--ref <branch-or-tag>` to pin a branch or tag.

### Configure ApiMind MCP

The Skills access contracts through the ApiMind Server MCP endpoint. After
running `make dev` in the unified repository, the local development endpoint
is `http://127.0.0.1:18889/mcp` and MCP authentication is disabled. Add this
URL in the Codex App MCP settings, or configure it in the target project's
`.codex/config.toml`:

```toml
[mcp_servers.apimind_mcp]
url = "http://127.0.0.1:18889/mcp"
enabled = true
```

For a remote Server with authentication enabled, never commit its token. Set
the token in a local environment variable and let Codex read it:

```toml
[mcp_servers.apimind_mcp]
url = "https://apimind.example.com/mcp"
bearer_token_env_var = "APIMIND_MCP_TOKEN"
enabled = true
```

Restart Codex App after installing or changing MCP configuration. The remote
Server administrator provides the endpoint, MCP setting, and token.

### Bind the Current Project

Invoke `apimind-project-config` in the repository whose API documentation you
want to maintain, or start from
[`examples/apimind-contract.yaml`](examples/apimind-contract.yaml) and create
this file at the repository root:

```yaml
apimind:
  workspace: "my-team"
  project: "my-api"
```

`workspace` and `project` are ApiMind names, not database IDs. The MCP token
authenticates access; this local mapping selects the target.

## Usage

Codex can select a Skill automatically from the task description. You can also
select one explicitly with `$` or `/skills`.

| Goal | Suggested prompt | Remote write |
| --- | --- | --- |
| Initialize project config | “Use `$apimind-project-config` to configure this repository for workspace `my-team` and project `my-api`.” | No; local configuration only |
| Review the binding | “Check whether this repository's ApiMind configuration is complete.” | No |
| Query or review a contract | “Use `$apimind-contract` to review the ApiMind documentation for `/api/users`.” | No; read-only by default |
| Create or update an interface | “Sync the latest `/api/users` contract to ApiMind.” | Yes; the Skill confirms the target and change first |

Code changes never trigger an automatic ApiMind write. Only explicit requests
to submit, update, sync, create, or write ApiMind API documentation enter the
write workflow.

## Compatibility

[`compatibility/server.yaml`](compatibility/server.yaml) declares the supported Server contracts:

- Server package version `0.1.0`;
- HTTP API contract `yapi-http-v1`;
- MCP contract `apimind-mcp-v1`.

```sh
node scripts/check-compatibility.mjs --mcp-tools tests/fixtures/mcp-tools.json
```

## Verification

The following command is for plugin maintainers, not installation. Verification
uses Node.js 22, installs no dependencies, requires no remote ApiMind access,
and needs no database or Docker:

```sh
sh scripts/verify.sh
```

## Documentation

Start with the [English documentation index](docs/README.en.md) for Skill entrypoints, compatibility, configuration examples, maintainer material, and security guidance. The [Chinese index](docs/README.md) is also available.

## Security

Read [SECURITY.md](SECURITY.md). Do not commit tokens, credentials, private endpoints, or machine-local paths.

## License

This repository is available under [Apache-2.0](LICENSE).
