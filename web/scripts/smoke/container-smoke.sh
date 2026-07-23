#!/bin/sh
set -eu

repo_dir=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
cd "$repo_dir"

test -f dist/index.html

image_name=${APIMIND_WEB_SMOKE_IMAGE:-apimind-web:smoke}
container_name="apimind-web-smoke-$$"

cleanup() {
  docker rm -f "$container_name" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

docker build -t "$image_name" .
docker run -d --name "$container_name" -p 127.0.0.1::8080 "$image_name" >/dev/null

port_mapping=$(docker port "$container_name" 8080/tcp)
host_port=${port_mapping##*:}
base_url="http://127.0.0.1:$host_port"

attempt=0
until index_html=$(curl -fsS "$base_url/"); do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 30 ]; then
    docker logs "$container_name"
    exit 1
  fi
  sleep 0.2
done

asset_path=$(printf '%s' "$index_html" | sed -n 's/.*src="\([^"]*\.js\)".*/\1/p' | head -n 1)
test -n "$asset_path"
curl -fsS "$base_url$asset_path" >/dev/null

docker exec "$container_name" sh -c \
  'test ! -e /usr/local/bin/node && test ! -e /usr/local/bin/npm && test ! -e /usr/share/nginx/html/server/app.js'

echo "container smoke passed: $base_url"
