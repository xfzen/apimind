#!/bin/sh
set -eu

repo_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
temporary_home=$(mktemp -d "${TMPDIR:-/tmp}/apimind-skills-install.XXXXXX")
trap 'rm -rf "$temporary_home"' EXIT INT TERM

install_dir="$temporary_home/codex/plugins/apimind"
mkdir -p "$(dirname -- "$install_dir")"
cp -R "$repo_dir" "$install_dir"
rm -rf "$install_dir/.git"

test -f "$install_dir/.codex-plugin/plugin.json"
test -f "$install_dir/skills/apimind-contract/SKILL.md"
test -f "$install_dir/skills/apimind-project-config/SKILL.md"
test "$(find "$install_dir/skills" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')" = 2
node "$install_dir/scripts/check-compatibility.mjs" \
  --mcp-tools "$install_dir/tests/fixtures/mcp-tools.json"

echo 'skills isolated install smoke passed'
