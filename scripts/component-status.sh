#!/bin/sh
set -eu

root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)

workspace_branch=$(git -C "$root" branch --show-current)
workspace_sha=$(git -C "$root" rev-parse HEAD)
server_sha=$(git -C "$root/server" rev-parse HEAD 2>/dev/null || printf "not-initialized")
web_version=$(node -p "require('$root/web/package.json').version")
skills_version=$(node -p "require('$root/skills/.codex-plugin/plugin.json').version")

printf "workspace branch=%s sha=%s\n" "${workspace_branch:-detached}" "$workspace_sha"
printf "web       source=workspace version=%s\n" "$web_version"
printf "server    source=submodule sha=%s\n" "$server_sha"
printf "skills    source=workspace version=%s\n" "$skills_version"
