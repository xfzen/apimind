#!/bin/sh
set -eu

ecp_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
tmp_dir=$(mktemp -d "${TMPDIR:-/tmp}/ecp-boundary.XXXXXX")
cleanup() {
  chmod -R u+w "$tmp_dir" 2>/dev/null || true
  rm -rf "$tmp_dir"
}
trap cleanup EXIT INT TERM
GOCACHE="$tmp_dir/go-build-cache"
GOMODCACHE="$tmp_dir/go-mod-cache"
GOPATH="$tmp_dir/go-path"
GOPROXY="https://proxy.golang.org"
GOSUMDB="sum.golang.org"
export GOCACHE GOMODCACHE GOPATH GOPROXY GOSUMDB
mkdir -p "$tmp_dir/ecp"
rsync -a \
  --exclude '/.artifacts/' \
  --exclude '/.run/' \
  --exclude '/server/.run/' \
  --exclude '/server/dist/' \
  --exclude '/ui/dist/' \
  --exclude '/ui/node_modules/' \
  "$ecp_dir/" "$tmp_dir/ecp/"

if grep -R -n -E '(^|["[:space:]])(\.\./)+(server|web|deploy)/|github.com/xfzen/apimind' \
  "$tmp_dir/ecp/server" "$tmp_dir/ecp/sdk" "$tmp_dir/ecp/scripts" 2>/dev/null \
  | grep -v '/scripts/verify-boundary.sh:'; then
  echo "ECP boundary references the parent ApiMind repository" >&2
  exit 1
fi

cd "$tmp_dir/ecp"
(cd sdk/go && GOWORK=off GOTOOLCHAIN=go1.25.12 go test -p 1 ./...)
(cd server && GOWORK=off GOTOOLCHAIN=go1.25.12 go test -p 1 ./...)
(cd tools && GOWORK=off GOTOOLCHAIN=go1.25.12 go mod verify)

if [ -f ui/package.json ]; then
  test -f ui/package-lock.json
  npm_config_cache="$tmp_dir/npm-cache"
  npm_config_registry="https://registry.npmjs.org/"
  export npm_config_cache npm_config_registry
  (cd ui && npm ci --ignore-scripts --no-audit --no-fund && npm run typecheck && npm test && npm run build)
fi

echo "incremental ECP-only boundary verification passed"
