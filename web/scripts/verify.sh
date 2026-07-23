#!/bin/sh
set -eu

repo_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$repo_dir"

node scripts/verify-docs.mjs scripts/verify-docs.config.json

if [ "${APIMIND_SKIP_INSTALL:-0}" != 1 ]; then
  npm ci --cache .npm-cache
fi

node --test tests/*.test.mjs
npm run lint
npm test
npm run smoke:schema-editor
npm run build

if [ "${APIMIND_SKIP_CONTAINER_SMOKE:-0}" != 1 ]; then
  npm run smoke:container
fi

if [ -n "${APIMIND_GITLEAKS_BIN:-}" ]; then
  scan_dir=$(mktemp -d "${TMPDIR:-/tmp}/apimind-web-scan.XXXXXX")
  trap 'rm -rf "$scan_dir"' EXIT INT TERM
  git archive HEAD | tar -x -C "$scan_dir"
  "$APIMIND_GITLEAKS_BIN" dir "$scan_dir" --no-banner --redact --exit-code 1
fi

git diff --check
status=$(git status --porcelain=v1 --untracked-files=all)
test -z "$status" || {
  echo 'verification left a dirty worktree:' >&2
  echo "$status" >&2
  exit 1
}

echo 'web verification passed'
