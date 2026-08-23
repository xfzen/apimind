#!/bin/sh
set -eu

ecp_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
"$ecp_dir/scripts/verify-inputs.sh"
tool_bin="$ecp_dir/.artifacts/toolchain/bin"
mkdir -p "$tool_bin"

cd "$ecp_dir/tools"
go_version=$(GOWORK=off GOTOOLCHAIN=go1.25.12 go env GOVERSION)
test "$go_version" = go1.25.12
GOWORK=off GOTOOLCHAIN=go1.25.12 go build -trimpath -o "$tool_bin/goctl" github.com/zeromicro/go-zero/tools/goctl
GOWORK=off GOTOOLCHAIN=go1.25.12 go build -trimpath -o "$tool_bin/goctl-swagger" github.com/zeromicro/goctl-swagger
test "$("$tool_bin/goctl" --version | awk '{print $3}')" = 1.9.2
"$tool_bin/goctl-swagger" --version | grep -Fq '20220621'

echo "pinned ECP tools are ready"
