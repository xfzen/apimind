#!/bin/sh
set -eu

server_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
ecp_dir=$(CDPATH= cd -- "$server_dir/.." && pwd)

for command_name in go node npm docker; do
  command -v "$command_name" >/dev/null 2>&1 || { echo "missing required command: $command_name" >&2; exit 1; }
done
test -f "$ecp_dir/versions.lock.yaml"
test -f "$ecp_dir/deploy/compose.yaml"
available_kb=$(df -Pk "$ecp_dir" | awk 'NR==2 {print $4}')
[ "${available_kb:-0}" -ge 1048576 ] || { echo "at least 1 GiB free space is required" >&2; exit 1; }
for port in 4001 18890; do
  if command -v lsof >/dev/null 2>&1 && lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then echo "port $port is already in use" >&2; exit 1; fi
done
if [ "${ECP_PREFLIGHT_ONLINE:-0}" = 1 ]; then
  command -v pg_isready >/dev/null 2>&1 || { echo "pg_isready is required for online preflight" >&2; exit 1; }
  pg_isready -d "${ECP_PREFLIGHT_DATABASE_DSN:?set ECP_PREFLIGHT_DATABASE_DSN}"
  curl -fsS "${ECP_PREFLIGHT_CASDOOR_URL:?set ECP_PREFLIGHT_CASDOOR_URL}" >/dev/null
fi
echo "ECP preflight passed"
