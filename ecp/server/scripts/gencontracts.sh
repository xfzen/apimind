#!/bin/sh
set -eu

repo_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$repo_dir"
ecp_dir=$(CDPATH= cd -- "$repo_dir/.." && pwd)
"$repo_dir/scripts/genapi.sh"
tool_bin="$ecp_dir/.artifacts/toolchain/bin"

swagger_dir=$(mktemp -d "${TMPDIR:-/tmp}/ecp-swagger.XXXXXX")
trap 'rm -rf "$swagger_dir"' EXIT HUP INT TERM
"$tool_bin/goctl" api plugin \
  -plugin "$tool_bin/goctl-swagger=swagger -filename ecp.swagger.json" \
  -api docs/ecp.api \
  -dir "$swagger_dir"
GOWORK=off GOTOOLCHAIN=go1.25.12 go run ./cmd/contractgen openapi "$swagger_dir/ecp.swagger.json"
