---
name: apimind-contract
description: Use when the user explicitly asks to submit, update, sync, create, or review API documentation in ApiMind via MCP. Applies to read-only ApiMind contract analysis and user-confirmed cat/interface upserts.
---

# ApiMind Contract

## Overview

Use this skill to maintain ApiMind API contracts through the active ApiMind MCP server.

MCP tokens authenticate access to ApiMind MCP. They do not limit which ApiMind workspace, project, cat, or interface data is visible. The target data boundary is the name-based `workspace` and `project` selected by local config, MCP discovery, or explicit user instructions.

ApiMind hierarchy:

```text
workspace / project / cat / interface
```

Chinese labels:

```text
工作区 / 项目 / 接口分组 / 接口
```

Default to read-only. Write only when the user explicitly asks to submit, update, sync, create, or write ApiMind API documentation.

For repository setup, `AGENTS.md`, `CLAUDE.md`, or `apimind-contract.yaml` project mapping work, use the `apimind-project-config` skill.

## Server Compatibility

This package declares Server `0.1.0`, HTTP API `yapi-http-v1`, and MCP `apimind-mcp-v1` compatibility in [`compatibility/server.yaml`](../../compatibility/server.yaml).

The active MCP schema remains authoritative for tool parameters. Before relying on the documented workflow, confirm that the active server exposes the required tools in the compatibility contract. If the contract version or a required tool is missing, stop and report the compatibility gap; do not invent a tool or bypass MCP.

## Terminology

Use these canonical names in Skill docs, repository instructions, local mapping files, and summaries:

| Canonical | Chinese | Meaning |
| --- | --- | --- |
| `workspace` | 工作区 | Top-level ApiMind boundary that contains projects. |
| `project` | 项目 | API documentation project inside a workspace. |
| `cat` | 接口分组 | Project-scoped interface grouping. |
| `interface` | 接口 | API contract entry. |
| `doc center` | 文档中心 | Workspace default documentation project for Markdown docs and reusable templates. |
| `doc group` | 文档分组 | First-level grouping inside a workspace doc center. |

Compatibility aliases are allowed only when reading legacy YApi-compatible data surfaces:

- `space` means `workspace`.
- `group`, `category`, and `folder` mean `cat` only when the schema shows project-scoped interface categories.

Do not introduce new canonical names such as `space`, `group`, `category`, or `folder` in new documentation, local config, or MCP calls.

## Boundaries

Allowed by default:

- Read workspaces, projects, cats, interfaces, and search results.
- Analyze code or docs and produce local recommendations without writing ApiMind.
- Suggest local workspace/project or interface-to-cat mapping updates without editing local files.

Allowed only after an explicit user ApiMind write request:

- Upsert project-scoped cat.
- Upsert interface.

Never do these through ApiMind MCP:

- Create, update, or delete workspace.
- Create, update, or delete project.
- Delete cat.
- Delete interface.
- Bulk update many interfaces unless the user explicitly asks for batch sync.
- Write ApiMind just because code changed.
- Use shell, curl, direct database access, or an HTTP workaround when MCP tools are available.
- Invent MCP tool names or parameters that are not in the active schema.
- Pass workspace/project/cat/interface ids to MCP tools. ApiMind MCP contract tools are name-based.

Local `apimind-contract.yaml` updates are repository configuration updates, not ApiMind MCP writes. Use `apimind-project-config` for those updates.

## Write Triggers

Treat these as explicit ApiMind write intent:

- "提交接口到 ApiMind"
- "更新 ApiMind 接口"
- "同步接口文档到 ApiMind"
- "写入接口文档"
- "创建或更新 cat"
- "将当前接口分析结果提交给 ApiMind"
- Equivalent English requests such as "submit/update/sync this API contract to ApiMind"

Do not treat these as write intent:

- "实现这个接口"
- "修改这个接口代码"
- "修复这个 bug"
- "分析这个代码"
- "生成测试"
- "补充普通文档"
- "重构 handler / DTO / route"
- "配置 ApiMind Skill 项目"
- "初始化 ApiMind Skill"
- General implementation, review, setup, or testing requests.

When intent is not explicit, stay read-only and tell the user what would be needed to write.

## Read Workflow

1. Resolve workspace and project names from root `apimind-contract.yaml`, ApiMind MCP query results, or explicit user instructions.
2. Use only the active MCP schema. Current ApiMind MCP read tools are name-based and may include:
   - `list_workspaces`, `get_workspace`
   - `list_projects`, `get_project`
   - `list_cats`, `get_cat`
   - `list_interfaces`, `get_interface`, `search_interfaces`
3. If the MCP server uses different names, use the active tool schema and state the mapping.
4. If there is no tool for required information, report the gap instead of guessing.

Do not use ids from tool output or prior conversations as write targets. If workspace/project/cat names do not resolve exactly, stop and ask the user to confirm names.

If local `apimind-contract.yaml` names do not resolve, do not assume the config is correct. First call `list_workspaces` to show all visible workspace names, then call `list_projects` for likely workspaces to find the correct project name. Workspace and project discovery should be possible even when the local binding is stale or wrong.

Do not interpret token scope fields such as `project_ids` or `space_ids` as ApiMind data filters. In the name-based MCP model, a valid token only proves that the agent may access ApiMind MCP.

## Write Workflow

ApiMind writes must follow this exact order.

### 1. Resolve workspace and project

Before any write, determine the target `workspace` and `project` from root `apimind-contract.yaml`, repository instructions such as `AGENTS.md` or `CLAUDE.md`, MCP query results, or explicit user instructions.

Rules:

- `workspace` and `project` are read-only through ApiMind MCP.
- Do not create, update, or delete `workspace`.
- Do not create, update, or delete `project`.
- If the target `workspace` or `project` cannot be confirmed by exact name, do not write.

### 2. Confirm or upsert cat

Every `interface` must belong to a confirmed project-scoped `cat`.

Before writing an interface:

- Search or list cats in the confirmed project.
- If the target cat already exists, reuse it.
- If the target cat does not exist and the user has asked to write/sync the affected interface docs, `upsert_cat` is allowed.
- Cat writes must be under the already-confirmed `workspace/project`.
- Do not delete cat.

### 3. Search then upsert interface

Every `interface` write must bind to the confirmed cat.

Before upserting an interface:

- Call `search_interfaces` or an equivalent active MCP search/read tool for the confirmed `workspace/project`.
- Match existing interfaces by method, full path, title, and nearby context.
- If the interface already exists, prefer updating/upserting the existing interface.
- If no matching interface exists, create/upsert a new interface.
- When writing multiple interfaces under the same confirmed `workspace/project/cat`, prefer `upsert_interfaces_batch` if the active MCP schema exposes it.
- Do not delete interface.
- Every write must include `source`, `agent_provider`, `change_reason`, and `change_summary`.
- HTTP interface request and response contracts must be written as JSON Schema, not as prose, examples, Go structs, TypeScript types, or markdown-only content.

General preconditions:

1. Confirm the user explicitly requested an ApiMind write.
2. Use only active MCP tools and their current schema.
3. If workspace, project, cat, interface, method, path, request JSON Schema, response JSON Schema, or interface create-vs-update is uncertain, do not write the interface. Present the candidates and ask the user to choose.

Before writing, unless the user explicitly asked for direct execution, output a short plan:

- Target workspace/project.
- Target cat.
- Target interface.
- Create or update.
- Reason.
- Remaining uncertainty.

After writing, summarize:

- Workspace/project/cat/interface written.
- Whether each resource was created or updated.
- Main changes.
- Any fields that were uncertain or omitted.
- Whether human review is recommended.

## Cat Creation And Maintenance

Project interface cats may be created or updated only after user confirmation.

The skill should provide a short cat plan before changing ApiMind:

- Proposed cat create or update.
- Which interfaces or route patterns will use it.
- Whether an existing cat can be reused instead.
- Any ambiguity or duplicate-name risk.

After confirmation, upsert the cat through MCP by workspace/project/cat names and then write the interface if the interface write is also confirmed or was part of the user's explicit request.

Cat maintenance includes:

- Create a missing project-scoped cat.
- Update a cat name or description when the user explicitly asks.
- Suggest merging or renaming cats, but do not delete cats.
- Suggest local mapping updates after a cat is confirmed.

Avoid generic buckets such as `Misc` or `Default` unless the project already uses that cat.

## Interface-To-Cat Mapping

Repositories may keep a small local `interface_cat_mapping` from interface patterns to ApiMind cats in root `apimind-contract.yaml`. Use mapping as a routing hint, not as proof that the remote cat exists:

1. Read the mapping.
2. Query ApiMind MCP for current project cats.
3. Match mapped cat names to actual cats.
4. If a mapped cat is missing, propose creating or repairing it and ask for confirmation.

When no local mapping exists, derive the target cat from existing cats and interface context: path prefix, title, tag, route group, handler module, service name, and neighboring ApiMind interfaces. If the result is clear, propose the cat and ask for confirmation before creating it. If several cats could fit, present the options.

Do not place actual cat mappings in `AGENTS.md` or `CLAUDE.md`. If the user asks to edit local mapping, use the `apimind-project-config` skill.

## Template Document Workflow

Templates are Markdown docs in each workspace default doc center. They are not HTTP interfaces, not cats/interfaces, and not a separate `_system/_templates` project.

Use ApiMind doc-center MCP tools:

- `get_doc_center`
- `list_docs`
- `search_docs`
- `get_doc`
- `upsert_doc`

Default behavior is read-only. Only call `upsert_doc` when the user explicitly asks to create or update an ApiMind Markdown doc or template doc.

For doc or template-doc writes:

- Read root `apimind-contract.yaml` first.
- Use `apimind.workspace` as MCP `workspace`.
- Use `apimind.project` as MCP `bound_project`.
- Write only to these doc-center first-level groups:
  - `Public`
  - `Templates`
  - the exact `apimind.project` value from local config
- Pass `parent_title` explicitly. Prefer title over slug for write routing.
- Do not write if `apimind-contract.yaml` is missing or does not contain both workspace and project.
- Do not write to another project group, even if the MCP server can see it.

ApiMind creates and maintains the doc-center first-level groups. Agents should not ask users to manually configure doc group mappings.

Distinguish template docs through the doc center's first-level `Templates` group or tags, for example a `template` tag. Do not use `project.kind=template` as the public model.

Never use `upsert_interface`, `upsert_interfaces_batch`, `upsert_cat`, or `update_cat` for Markdown docs or template docs.

Do not generate or submit method, path, request, response, schema, mock, run, or interface test fields for templates.

`upsert_doc` must include:

- `workspace`
- `bound_project`
- `parent_title`
- `title`
- `content_md`
- `change_reason`
- `change_summary`

If the active MCP server does not expose doc-center tools, report the gap. Do not emulate Markdown doc or template updates through normal cat/interface tools.

## Write Metadata

Every cat/interface write must include:

- `source`: default `ai_agent` for agent writes
- `agent_provider`: default `codex`; use `claude`, `gemini`, or another provider when that agent is the executor
- `change_reason`
- `change_summary`

If the active MCP write schema does not expose `source`, `agent_provider`, `change_reason`, and `change_summary`, do not write. Report the schema gap instead of hiding required metadata in markdown or unsupported parameters.

## Name-Based MCP Calls

ApiMind MCP contract tools must be called with names, not ids:

- `workspace`: workspace name, such as `mydev`
- `project`: project name, such as `apimind`
- `cat`: interface cat name, such as `user.api`
- `method` and `path`: interface identity inside a project

Do not call tools with `workspace_id`, `space_id`, `project_id`, `group_id`, `cat_id`, or interface `id`. If a tool schema exposes ids, treat that MCP server as incompatible with this skill version and report the mismatch instead of guessing.

## Interface Content Checklist

For HTTP interfaces, capture as much as available:

- workspace name
- project name
- cat name
- method
- full route path as implemented externally, including service prefix such as `/api`
- title
- description
- auth requirements
- request headers
- path params
- query params
- body schema
- response schema
- examples
- error codes
- source
- agent provider
- change reason
- change summary

### JSON Schema Requirement

For HTTP interface writes, request and response contracts must be represented as JSON Schema.

Rules:

- Translate source contracts such as go-zero `.api` types, Go structs, OpenAPI schemas, YApi definitions, or observed implementation models into JSON Schema before writing.
- Prefer structured MCP fields:
  - `request_schema`
  - `response_schema`
  - `request_example`
  - `response_example`
  - `description`
- `request_schema` and `response_schema` must be JSON Schema objects. Do not put examples, prose, Markdown tables, Go structs, TypeScript interfaces, or raw sample payloads into schema fields.
- Send examples only through `request_example` and `response_example`. The backend may infer JSON Schema from examples only when the schema field is absent.
- Do not write schema-like content into `description`, `markdown`, `req_body_other`, or `res_body`. Legacy YApi-compatible fields are storage/output compatibility fields, not preferred agent write fields.
- For interfaces without a request body, omit request-body fields when the MCP schema allows omission. If the schema requires a body field, use an empty object schema such as `{"type":"object","additionalProperties":false}` and state that the endpoint has no request body.
- Keep query params, path params, headers, and form fields in their structured MCP fields, but their `type`, `required`, `example`, and `desc` values must match the JSON Schema contract.
- If schema cannot be confirmed from source contracts or reliable examples, mark the uncertainty and do not invent schema.
- If ApiMind MCP returns schema validation errors, report the exact error to the user. Do not retry by writing legacy fields or hiding schema in Markdown.
- If the active MCP write schema does not support `request_schema` and `response_schema` or equivalent structured JSON Schema fields for request and response bodies, do not write the interface. Report the schema gap.

When the MCP schema supports structured fields, write:

- query parameters to `req_query`
- path parameters to `req_params`
- headers to `req_headers`
- form fields to `req_body_form`
- request body JSON Schema to `request_schema`
- response body JSON Schema to `response_schema`
- examples to `request_example` and `response_example`

### Batch Interface Writes

When writing multiple interfaces under the same confirmed `workspace/project/cat`, prefer `upsert_interfaces_batch`.

Rules:

- Batch only interfaces that belong to the same cat.
- Do not batch across cats.
- Resolve workspace, project, and cat before batch writes.
- If the target cat does not exist and the user confirmed the cat, upsert the cat first or use an MCP batch tool that explicitly upserts the named cat.
- Use `upsert_interface` only for a single interface or when the active MCP schema does not expose `upsert_interfaces_batch`.
- If a batch result contains failed items, summarize each failed item and do not retry through legacy fields.

For go-zero repositories, use the `.api` file service prefix plus route path as the external path, and use `.api` request/response type definitions as the contract source. Generated handlers can confirm the final registered route, but handler names alone are not enough for ApiMind interface content.

For WebSocket or event-style interfaces, capture as much as available:

- endpoint
- handshake headers
- message types
- envelope schema
- payload schema
- ack rules
- error rules
- response envelope
- examples

## Publishing Boundary

This skill is part of the ApiMind plugin package. Keep it self-contained:

- Do not reference local absolute paths.
- Do not depend on this repository's uncommitted files.
- Do not include business code or MCP server implementation.
- Use `apimind-project-config` for repository-local setup files.
