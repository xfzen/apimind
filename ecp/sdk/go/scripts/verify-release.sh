#!/bin/sh
set -eu

module_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$module_dir"

test "$(sed -n 's/^module //p' go.mod)" = "github.com/xfzen/ecp/sdk/go"
if grep -Eq '^(replace|exclude|retract)[[:space:]]' go.mod; then
  echo "release module must not contain replace, exclude, or retract directives" >&2
  exit 1
fi

cache_dir=$(mktemp -d "${TMPDIR:-/tmp}/ecp-sdk-release.XXXXXX")
trap 'rm -rf "$cache_dir"' EXIT HUP INT TERM
GOCACHE="$cache_dir/go-build" GOWORK=off GOTOOLCHAIN=go1.25.12 go test ./... -count=1

mkdir -p "$cache_dir/importcheck"
printf '%s\n' 'module example.com/ecp-sdk-importcheck' '' 'go 1.25.12' '' 'require github.com/xfzen/ecp/sdk/go v0.0.0' '' "replace github.com/xfzen/ecp/sdk/go => $module_dir" > "$cache_dir/importcheck/go.mod"
printf '%s\n' 'package importcheck' '' 'import connectorv1 "github.com/xfzen/ecp/sdk/go/connector/v1"' '' 'var _ = connectorv1.DelegationTypeV1' > "$cache_dir/importcheck/import_test.go"
(cd "$cache_dir/importcheck" && GOCACHE="$cache_dir/go-build" GOWORK=off GOTOOLCHAIN=go1.25.12 go test ./... -count=1)

echo "local Connector SDK release verification passed"
