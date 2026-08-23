#!/bin/sh
set -eu

server_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
ecp_dir=$(CDPATH= cd -- "$server_dir/.." && pwd)
run_dir="$server_dir/.run"
mkdir -p "$run_dir"
"$server_dir/scripts/dev-stop.sh"

cd "$server_dir"
CGO_ENABLED=0 go build -o "$run_dir/ecp-api" ./api
CGO_ENABLED=0 go build -o "$run_dir/ecp-ui-server" ./cmd/ui-server
("$run_dir/ecp-api" -f "${ECP_CONFIG_FILE:-$server_dir/etc/ecp.local.yaml}" >"$run_dir/ecp-api.log" 2>&1) &
echo $! > "$run_dir/ecp-api.pid"
("$run_dir/ecp-ui-server" -listen 127.0.0.1:4001 -dir "$ecp_dir/ui/dist" -api http://127.0.0.1:18890 >"$run_dir/ecp-ui.log" 2>&1) &
echo $! > "$run_dir/ecp-ui.pid"
echo "ECP API: http://127.0.0.1:18890; ECP UI: http://127.0.0.1:4001"
