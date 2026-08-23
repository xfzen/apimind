#!/bin/sh
set -eu

repo_dir=$(CDPATH= cd -- "$(dirname -- "$0")/../../.." && pwd)
cd "$repo_dir"

: "${APIMIND_DEFAULT_PASSWORD:?APIMIND_DEFAULT_PASSWORD is required}"
username=${APIMIND_DEFAULT_USERNAME:-admin@example.invalid}
server_port=${APIMIND_LIVE_SERVER_PORT:-18889}
web_port=${APIMIND_LIVE_WEB_PORT:-4000}
cdp_port=${APIMIND_LIVE_CDP_PORT:-19222}

validate_port() {
  port=$1
  variable=$2
  case "$port" in
    ''|*[!0-9]*)
      echo "$variable must contain only decimal digits" >&2
      exit 1
      ;;
  esac
  if [ "$port" -lt 1 ] || [ "$port" -gt 65535 ]; then
    echo "$variable must be within 1..65535" >&2
    exit 1
  fi
}

probe_port() {
  port=$1
  variable=$2
  if ! node -e '
    const net = require("node:net");
    const port = Number(process.argv[1]);
    const server = net.createServer();
    server.once("error", () => process.exit(1));
    server.listen({ host: "127.0.0.1", port, exclusive: true }, () => {
      server.close(() => process.exit(0));
    });
  ' "$port"; then
    echo "port $port selected by $variable is already in use" >&2
    exit 1
  fi
}

validate_port "$server_port" APIMIND_LIVE_SERVER_PORT
validate_port "$web_port" APIMIND_LIVE_WEB_PORT
validate_port "$cdp_port" APIMIND_LIVE_CDP_PORT
if [ "$server_port" -eq 18888 ]; then
  echo "APIMIND_LIVE_SERVER_PORT must not use desktop embedded port 18888" >&2
  exit 1
fi
if [ "$server_port" -eq "$web_port" ] || [ "$server_port" -eq "$cdp_port" ] || [ "$web_port" -eq "$cdp_port" ]; then
  echo "APIMIND_LIVE_SERVER_PORT, APIMIND_LIVE_WEB_PORT, and APIMIND_LIVE_CDP_PORT must be distinct" >&2
  exit 1
fi

probe_port "$server_port" APIMIND_LIVE_SERVER_PORT
probe_port "$web_port" APIMIND_LIVE_WEB_PORT
probe_port "$cdp_port" APIMIND_LIVE_CDP_PORT

project_name="apimind-ts-pilot-$(date +%s)-$$"
vite_pid=''
chrome_pid=''

compose() {
  APIMIND_DEFAULT_USERNAME="$username" \
  APIMIND_DEFAULT_PASSWORD="$APIMIND_DEFAULT_PASSWORD" \
  APIMIND_SERVER_PORT="$server_port" \
    docker compose \
      --env-file "$repo_dir/.env.example" \
      -p "$project_name" \
      -f "$repo_dir/deploy/docker-compose.yml" \
      -f "$repo_dir/deploy/docker-compose.dev.yml" \
      "$@"
}

cleanup() {
  status=$?
  trap - EXIT INT TERM
  if [ -n "$vite_pid" ]; then
    kill "$vite_pid" 2>/dev/null || true
    wait "$vite_pid" 2>/dev/null || true
  fi
  if [ -n "$chrome_pid" ]; then
    kill "$chrome_pid" 2>/dev/null || true
    wait "$chrome_pid" 2>/dev/null || true
  fi
  compose down -v --remove-orphans >/dev/null 2>&1 || true
  exit "$status"
}

trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

wait_for_http() {
  url=$1
  label=$2
  process_pid=${3:-}
  attempt=0
  while [ "$attempt" -lt 180 ]; do
    if curl -fsS --max-time 2 "$url" >/dev/null 2>&1; then
      return 0
    fi
    if [ -n "$process_pid" ] && ! kill -0 "$process_pid" 2>/dev/null; then
      echo "$label exited before becoming ready: $url" >&2
      return 1
    fi
    attempt=$((attempt + 1))
    sleep 2
  done
  echo "timed out waiting for $label: $url" >&2
  return 1
}

compose up -d --build mongo server
wait_for_http "http://127.0.0.1:${server_port}/api/ping" "Go service"

(
  cd "$repo_dir/web"
  npm run dev-copy-icon
  npm run prepare:plugins
  YAPI_API_TARGET="http://127.0.0.1:${server_port}" \
  YAPI_WEB_HOST=127.0.0.1 \
  YAPI_WEB_PORT="$web_port" \
  VITE_CACHE_DIR=node_modules/.vite-live \
  VITE_OPEN=false \
    exec ./node_modules/.bin/vite --force
) &
vite_pid=$!

(
  cd "$repo_dir/web"
  PLAYWRIGHT_CDP_PORT="$cdp_port" exec node scripts/start-chrome-cdp.mjs
) &
chrome_pid=$!

wait_for_http "http://127.0.0.1:${web_port}/" "Vite" "$vite_pid"
wait_for_http "http://127.0.0.1:${cdp_port}/json/version" "Chrome CDP" "$chrome_pid"

export APIMIND_DEFAULT_USERNAME="$username"
export APIMIND_LIVE_BASE_URL="http://127.0.0.1:${web_port}"
export PLAYWRIGHT_CDP_ENDPOINT="http://127.0.0.1:${cdp_port}"

cd "$repo_dir/web"
npx playwright test --config playwright.live.config.ts
