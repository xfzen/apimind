# AGENTS.md

This repository uses ApiMind for API documentation.

ApiMind hierarchy:

workspace / project / cat / interface

Chinese labels:

工作区 / 项目 / 接口分组 / 接口

Do not automatically update ApiMind when code changes.

Only use the ApiMind Contract Skill when the user explicitly asks to submit, update, or sync API documentation to ApiMind.

Read project mapping from root `apimind-contract.yaml`, ApiMind MCP query results, or explicit user instructions.

Do not directly access or modify the database.

Do not delete ApiMind resources.

Do not add CLI workflows for ApiMind contract maintenance.

Execution constraints:

- Do not start subagents by default. Use subagents only when the user explicitly requests delegation; otherwise perform all repository analysis, implementation, review, and verification in the primary agent session.
- When starting or restarting ApiMind locally, ensure that only the latest instance built from the current checkout remains running. Replace any older ApiMind instance instead of leaving multiple instances running in parallel.

Software supply-chain constraints:

- Download software, toolchains, dependencies, vulnerability databases, and other build inputs only from the official upstream project or its publisher-maintained registry/repository.
- Download Go toolchains only from official Go distribution endpoints such as `go.dev` or `dl.google.com`, and verify the published checksum before use.
- Resolve Go, Node.js, and other language dependencies only through their official ecosystem registries/proxies or the dependency author's official repository. Do not substitute third-party mirrors or repackaged archives.
- Pull Docker images only from the image publisher's official registry/repository. Keep immutable digest pins where the repository already requires them.
- Download developer and security tools only from the vendor's official release page, official registry, or official container repository. Verify published checksums or signatures when available.
- If an official source is unavailable or verification fails, stop and report the blocker. Do not silently switch to a mirror, proxy, fork, or unofficial download host.

App development constraints:

- During PC App development, do not package/build the desktop app bundle unless the user explicitly asks for packaging.
- Prefer WebUI development mode plus the local Go service for verification.
- Docker app-dev uses host port `18889` by default; keep desktop embedded server defaults such as `18888` separate from WebUI dev proxy targets.
- WebUI code must not call remote ApiMind/YApi/business APIs directly; all such calls must go through Go-side services.
