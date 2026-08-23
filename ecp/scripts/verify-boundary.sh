#!/bin/sh
set -eu

ecp_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
tmp_dir=$(mktemp -d "${TMPDIR:-/tmp}/ecp-boundary.XXXXXX")
trap 'rm -rf "$tmp_dir"' EXIT INT TERM
cp -R "$ecp_dir" "$tmp_dir/ecp"
rm -rf "$tmp_dir/ecp/.artifacts" "$tmp_dir/ecp/.run" "$tmp_dir/ecp/server/dist" "$tmp_dir/ecp/ui/dist" "$tmp_dir/ecp/ui/node_modules"

if grep -R -n -E '(^|["[:space:]])(\.\./)+(server|web|deploy)/|github.com/xfzen/apimind' \
  "$tmp_dir/ecp/server" "$tmp_dir/ecp/sdk" "$tmp_dir/ecp/scripts" 2>/dev/null \
  | grep -v '/scripts/verify-boundary.sh:'; then
  echo "ECP boundary references the parent ApiMind repository" >&2
  exit 1
fi

cd "$tmp_dir/ecp"
(cd sdk/go && GOWORK=off GOTOOLCHAIN=go1.25.12 go test ./...)
(cd server && GOWORK=off GOTOOLCHAIN=go1.25.12 go test ./...)
(cd tools && GOWORK=off GOTOOLCHAIN=go1.25.12 go mod verify)

if [ -f ui/package.json ]; then
  test -f ui/package-lock.json
  (cd ui && npm ci --ignore-scripts --no-audit --no-fund && npm run typecheck && npm test && npm run build)
fi

echo "incremental ECP-only boundary verification passed"
