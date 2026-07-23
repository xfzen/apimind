# ApiMind Skills Plugin

[中文](README.md)

## Overview

ApiMind Skills is a standalone Codex plugin package for configuring repository-local ApiMind project mappings and safely reading or maintaining API contracts through MCP. It contains no Server, Web, application, database-access, or business code.

## Included Skills

- [`apimind-project-config`](skills/apimind-project-config/SKILL.md) manages repository-local `AGENTS.md`, optional `CLAUDE.md`, and `apimind-contract.yaml` bindings;
- [`apimind-contract`](skills/apimind-contract/SKILL.md) reads ApiMind contracts and creates or updates cats and interfaces only after explicit user intent and the confirmation required by the Skill.

Every write requires an explicit user request and the Skill confirmation flow. The plugin does not access the database directly or delete ApiMind resources.

## Quick Start

Clone or copy the repository into a Codex plugin directory, preserving `.codex-plugin/plugin.json` and `skills/` together in the package:

```sh
sh tests/install-smoke.sh
```

When configuring a project mapping, start from [`examples/apimind-contract.yaml`](examples/apimind-contract.yaml) and replace the placeholders with confirmed workspace and project names.

## Compatibility

[`compatibility/server.yaml`](compatibility/server.yaml) declares the supported Server contracts:

- Server package version `0.1.0`;
- HTTP API contract `yapi-http-v1`;
- MCP contract `apimind-mcp-v1`.

```sh
node scripts/check-compatibility.mjs --mcp-tools tests/fixtures/mcp-tools.json
```

## Verification

Verification uses Node.js 22, installs no dependencies, requires no remote ApiMind access, and needs no database or Docker:

```sh
sh scripts/verify.sh
```

## Documentation

Start with the [English documentation index](docs/README.en.md) for Skill entrypoints, compatibility, configuration examples, maintainer material, and security guidance. The [Chinese index](docs/README.md) is also available.

## Security

Read [SECURITY.md](SECURITY.md). Do not commit tokens, credentials, private endpoints, or machine-local paths.

## License

This repository is available under [Apache-2.0](LICENSE).
