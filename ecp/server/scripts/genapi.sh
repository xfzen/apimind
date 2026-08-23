#!/bin/sh
set -eu

repo_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$repo_dir"
ecp_dir=$(CDPATH= cd -- "$repo_dir/.." && pwd)
"$ecp_dir/scripts/bootstrap-tools.sh"
tool_bin="$ecp_dir/.artifacts/toolchain/bin"

"$tool_bin/goctl" api go -api docs/ecp.api -dir api
perl -0pi -e 's/\n+\z/\n/' docs/ecp.api
rm -rf api/etc
rm -rf api/internal/config
rm -f api/internal/middleware/adminsessionmiddleware.go
rm -f api/internal/middleware/connectormachinemiddleware.go
rm -f api/internal/middleware/csrfmiddleware.go
rm -f api/internal/middleware/idempotencyheadersmiddleware.go
rm -f api/internal/middleware/ratelimitmiddleware.go
