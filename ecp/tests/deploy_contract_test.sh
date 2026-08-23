#!/bin/sh
set -eu

ecp_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)

for binary in ecp-api ecp-migrate ecp-audit-bootstrap ecp-bootstrap ecp-ui-server; do
  metadata=$(go version -m "$ecp_dir/server/dist/$binary")
  printf '%s\n' "$metadata" | grep -q 'GOOS=linux' || {
    echo "$binary is not a Linux container artifact" >&2
    exit 1
  }
  printf '%s\n' "$metadata" | grep -q 'CGO_ENABLED=0' || {
    echo "$binary is not a static container artifact" >&2
    exit 1
  }
done

compose_json=$(docker compose \
  --env-file "$ecp_dir/deploy/.env.example" \
  -f "$ecp_dir/deploy/compose.yaml" \
  config --format json)

printf '%s' "$compose_json" | jq -e '
  .services.casdoor.entrypoint == ["/bin/sh", "-c"] and
  (.services.casdoor.command | type == "array") and
  (.services.casdoor.command | join(" ") | contains("exec /server"))
' >/dev/null || {
  echo "Casdoor Compose service does not override the image entrypoint safely" >&2
  exit 1
}

echo "ECP deployment contract tests passed"
