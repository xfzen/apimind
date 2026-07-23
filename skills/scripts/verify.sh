#!/bin/sh
set -eu

repo_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
root=$repo_dir
package_check=false
require_clean=false

while [ "$#" -gt 0 ]; do
  case "$1" in
    --root)
      root=$2
      shift 2
      ;;
    --package-check)
      package_check=true
      shift
      ;;
    --require-clean)
      require_clean=true
      shift
      ;;
    *)
      echo "unknown argument: $1" >&2
      exit 2
      ;;
  esac
done

node "$repo_dir/scripts/package-check.mjs" "$root"

if [ "$package_check" = true ]; then
  exit 0
fi

cd "$root"
node --test tests/*.test.mjs
sh tests/install-smoke.sh
node scripts/check-compatibility.mjs --mcp-tools tests/fixtures/mcp-tools.json

if [ -n "${APIMIND_GITLEAKS_BIN:-}" ]; then
  scan_dir=$(mktemp -d "${TMPDIR:-/tmp}/apimind-skills-scan.XXXXXX")
  trap 'rm -rf "$scan_dir"' EXIT INT TERM
  git archive HEAD | tar -x -C "$scan_dir"
  "$APIMIND_GITLEAKS_BIN" dir "$scan_dir" --no-banner --redact --exit-code 1
fi

if [ "$require_clean" = true ] && [ -n "$(git status --short)" ]; then
  echo 'working tree is not clean' >&2
  git status --short >&2
  exit 1
fi

echo 'skills verification passed'
