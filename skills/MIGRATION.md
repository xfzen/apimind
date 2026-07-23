# Migration

This standalone repository contains only the ApiMind Codex plugin package. Server, Web, application, database, and business-code files were intentionally excluded so the package can be installed and verified independently.

The package retains `.codex-plugin/plugin.json`, the two Skill directories, compatibility metadata, examples, tests, and maintainer documentation. It is maintained under `skills/` in <https://github.com/xfzen/apimind>.

The maintenance prompt is at [`docs/apimind-contract-skill-maintenance-prompt.md`](docs/apimind-contract-skill-maintenance-prompt.md), and runtime compatibility is declared in [`compatibility/server.yaml`](compatibility/server.yaml).
