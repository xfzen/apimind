#!/bin/sh
set -eu

ecp_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
tmp_dir=$(mktemp -d "${TMPDIR:-/tmp}/ecp-standalone.XXXXXX")
cleanup() {
  if [ -f "$tmp_dir/ecp/server/.run/test-db.env" ]; then (cd "$tmp_dir/ecp/server" && ./scripts/test-db-down.sh) >/dev/null 2>&1 || true; fi
  chmod -R u+w "$tmp_dir" 2>/dev/null || true
  rm -rf "$tmp_dir"
}
trap cleanup EXIT INT TERM
mkdir -p "$tmp_dir/ecp"
rsync -a --exclude '/.artifacts/' --exclude '/.run/' --exclude '/server/.run/' --exclude '/server/dist/' --exclude '/ui/dist/' --exclude '/ui/node_modules/' "$ecp_dir/" "$tmp_dir/ecp/"
cd "$tmp_dir/ecp"

./scripts/verify-inputs.sh
./scripts/bootstrap-tools.sh
export PATH="$tmp_dir/ecp/.artifacts/toolchain/bin:$PATH"
export GOCACHE="${ECP_STANDALONE_GOCACHE:-$(go env GOCACHE)}"
(cd server && ./scripts/gencontracts.sh && GOWORK=off GOTOOLCHAIN=go1.25.12 go test ./... && GOWORK=off GOTOOLCHAIN=go1.25.12 go vet ./...)
(cd sdk/go && GOWORK=off GOTOOLCHAIN=go1.25.12 go test ./... && GOWORK=off GOTOOLCHAIN=go1.25.12 go vet ./...)
(cd ui && npm ci --ignore-scripts --no-audit --no-fund --registry=https://registry.npmjs.org && npm run typecheck && npm test && npm run build)
mkdir -p server/dist
(cd server && CGO_ENABLED=0 GOWORK=off GOTOOLCHAIN=go1.25.12 go build -trimpath -o dist/ecp-api ./api && CGO_ENABLED=0 GOWORK=off GOTOOLCHAIN=go1.25.12 go build -trimpath -o dist/ecp-migrate ./cmd/migrate && CGO_ENABLED=0 GOWORK=off GOTOOLCHAIN=go1.25.12 go build -trimpath -o dist/ecp-audit-bootstrap ./cmd/audit-bootstrap && CGO_ENABLED=0 GOWORK=off GOTOOLCHAIN=go1.25.12 go build -trimpath -o dist/ecp-ui-server ./cmd/ui-server)
docker compose --env-file deploy/.env.example -f deploy/compose.yaml config >/dev/null

if [ "${ECP_VERIFY_DATABASES:-1}" = 1 ]; then
  (cd server && ./scripts/test-db-up.sh)
  . server/.run/test-db.env
  (cd server && GOWORK=off GOTOOLCHAIN=go1.25.12 go test ./internal/migration -run TestMigrationRoundTrip -count=1)
  (cd server && ECP_DB_DRIVER=postgres ECP_MIGRATION_DSN="$ECP_TEST_POSTGRES_MIGRATION_DSN" GOWORK=off GOTOOLCHAIN=go1.25.12 go run ./cmd/audit-bootstrap bootstrap)
  (cd server && ECP_DB_DRIVER=mysql ECP_MIGRATION_DSN="$ECP_TEST_MYSQL_MIGRATION_DSN" GOWORK=off GOTOOLCHAIN=go1.25.12 go run ./cmd/audit-bootstrap bootstrap)
  (cd server && GOWORK=off GOTOOLCHAIN=go1.25.12 go test ./internal/service/audit -run 'TestAuditRoleGrants|TestBusinessMutationAndCommittedAuditRollbackTogether' -count=1)
  (cd server && ./scripts/test-db-down.sh)
fi
echo "standalone ECP deployment verification passed"
