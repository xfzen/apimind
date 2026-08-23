#!/bin/sh
set -eu

server_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
run_dir="$server_dir/.run"

stop_component() {
  pid_file=$1
  marker=$2
  [ -f "$pid_file" ] || return 0
  pid=$(sed -n '1p' "$pid_file")
  case "$pid" in ''|*[!0-9]*) echo "invalid PID file: $pid_file" >&2; exit 1;; esac
  if ps -p "$pid" -o command= >/dev/null 2>&1; then
    command_line=$(ps -p "$pid" -o command=)
    case "$command_line" in *"$server_dir"*"$marker"*) kill "$pid";; *) echo "refusing to stop unrelated PID $pid" >&2; exit 1;; esac
  fi
  rm -f "$pid_file"
}

stop_component "$server_dir/.run/ecp-api.pid" ecp-api
stop_component "$server_dir/.run/ecp-ui.pid" ecp-ui-server
