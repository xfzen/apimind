---
name: apimind-project-config
description: Use when the user asks to initialize, configure, bind, update, or review ApiMind Skill project settings for a repository, including AGENTS.md, CLAUDE.md, and apimind-contract.yaml workspace/project mapping.
---

# ApiMind Project Config

## Overview

Use this skill to manage repository-local ApiMind Skill configuration. This covers:

- `AGENTS.md` for Codex-compatible repository guidance.
- `CLAUDE.md` when the repository or user needs Claude compatibility.
- Root `apimind-contract.yaml` for workspace/project binding and optional interface-to-cat routing hints.

This is local project configuration, not an ApiMind MCP write.

For actual ApiMind cat/interface contract reads or writes, use the `apimind-contract` skill.

The companion Server contract is declared in [`compatibility/server.yaml`](../../compatibility/server.yaml). If the active MCP server does not match it, report the compatibility gap before using remote discovery; local placeholder configuration may still be prepared when the user requests it.

MCP tokens authenticate access to ApiMind MCP only. They do not define the data scope. The repository-local `workspace` and `project` names select the target project.

## Terminology

Use these canonical names in Skill docs, repository instructions, local mapping files, and summaries:

| Canonical | Chinese | Meaning |
| --- | --- | --- |
| `workspace` | 工作区 | Top-level ApiMind boundary that contains projects. |
| `project` | 项目 | API documentation project inside a workspace. |
| `cat` | 接口分组 | Project-scoped interface grouping. |
| `interface` | 接口 | API contract entry. |

Compatibility aliases are allowed only when reading legacy YApi-compatible surfaces:

- `space` means `workspace`.
- `group`, `category`, and `folder` mean `cat` only when the schema shows project-scoped interface categories.

Do not introduce new canonical names such as `space`, `group`, `category`, or `folder` in new documentation, local config, or MCP calls.

## Boundaries

Allowed after the user asks to configure or manage ApiMind Skill project settings:

- Create or update the target repository's `AGENTS.md` with minimal ApiMind guidance.
- Create or update `CLAUDE.md` with the same guidance when the repository or user uses Claude.
- Create or update root `apimind-contract.yaml`.
- Add or update optional `interface_cat_mapping` when the user explicitly asks for local routing hints.

Never do these in this skill:

- Write remote ApiMind workspace/project/cat/interface records.
- Use shell, curl, direct database access, or CLI workarounds for ApiMind writes.
- Put workspace/project values or cat mappings in `AGENTS.md` or `CLAUDE.md`.
- Create root `apimind.yaml` or Markdown files for Skill configuration.
- Delete ApiMind resources.

## Project Configuration Workflow

1. Inspect the target repository for `AGENTS.md`, `CLAUDE.md`, root `apimind-contract.yaml`, and service runtime configs such as `apimind/etc/apimind.yaml`.
2. Create or update `AGENTS.md` with only repository-level ApiMind guidance. Preserve existing unrelated instructions.
3. If the repository uses Claude or the user asks for Claude compatibility, create or update `CLAUDE.md` with the same repository-level guidance. Preserve existing unrelated instructions.
4. Create root `apimind-contract.yaml` if it is missing.
5. If the user has not provided workspace/project values, leave placeholders and ask the user to provide the binding.
6. If the user provides workspace/project names, update only the name mapping fields in `apimind-contract.yaml`.
7. Do not store workspace/project ids. ApiMind MCP contract tools resolve by names.
8. If multiple remote workspaces or projects match provided names, ask the user to choose the correct names before writing local config.

If an existing local binding does not resolve through MCP, treat the local config as stale or wrong. Use name-based MCP discovery to list all visible workspaces, then list all projects under candidate workspaces, and only update `apimind-contract.yaml` after the user confirms the correct workspace/project names.

Do not ask users to fix MCP token `project_ids` or `space_ids` for data visibility. The token controls MCP access; the local binding controls the target ApiMind project.

`AGENTS.md` and `CLAUDE.md` should say:

- This repository uses ApiMind for API documentation.
- ApiMind hierarchy is `workspace / project / cat / interface` (`工作区 / 项目 / 接口分组 / 接口`).
- Do not automatically update ApiMind when code changes.
- Only use the ApiMind Contract Skill when the user explicitly asks to submit, update, or sync API documentation to ApiMind.
- Read project mapping from root `apimind-contract.yaml`, ApiMind MCP query results, or explicit user instructions.
- Do not directly access or modify the database.
- Do not delete ApiMind resources.
- Do not add CLI workflows for ApiMind contract maintenance.

Do not place workspace/project values or cat mappings in `AGENTS.md` or `CLAUDE.md`.

## Workspace Docs And Templates

Each workspace has one default doc center. Markdown docs and reusable template docs live in that workspace doc center.

Do not add `_system/_templates` to repository project binding config.

Repository project config only binds business API projects. Doc and template-doc discovery or updates use ApiMind doc-center tools from the `apimind-contract` skill.

Whether a doc is a template should be represented by a doc-center group or tag, not by a separate ApiMind project binding.

The root `apimind-contract.yaml` project name also acts as the doc-center write boundary for MCP doc writes. Agents should not ask users to manually configure doc group mappings. `Public`, `Templates`, and the bound project group are created by ApiMind.

## Config File

Prefer root `apimind-contract.yaml` to avoid confusion with service runtime configs such as `apimind/etc/apimind.yaml`.

Minimal placeholder template:

```yaml
apimind:
  workspace: "<workspace>"
  project: "<project>"
```

When values are provided:

```yaml
apimind:
  workspace: mydev
  project: apimind
```

Optional interface-to-cat routing hints:

```yaml
apimind:
  workspace: mydev
  project: apimind
  interface_cat_mapping:
    "/api/users/**": "User"
    "/api/projects/**": "Project"
    "internal/mcp/**": "MCP"
```

Mapping keys may be HTTP path patterns, `METHOD path` patterns, OpenAPI tags, route groups, or repository module globs. Keep them broad and stable. Do not create per-interface entries unless the project truly needs that precision.

Do not suggest `default_cat`. If the repository needs stable local interface-to-cat routing, use `interface_cat_mapping`.

Do not create a root `apimind.yaml` or Markdown files for Skill configuration. `apimind.yaml` is too easy to confuse with ApiMind service runtime configuration, and Markdown is not reliable for structured automated updates.

## Summary Requirements

After changing local project config, summarize:

- Which local files were created or updated.
- Whether `workspace` and `project` values are placeholders or confirmed.
- Whether remote names still need MCP resolution.
- Any remaining questions the user must answer before ApiMind contract writes are allowed.

## Publishing Boundary

This skill is part of the ApiMind plugin package. Keep it self-contained:

- Do not reference local absolute paths.
- Do not depend on this repository's uncommitted files.
- Do not include business code or MCP server implementation.
- Do not modify remote ApiMind data.
