#!/bin/sh
set -eu

repo_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
ecp_dir=$(CDPATH= cd -- "$repo_dir/.." && pwd)
run_dir="$repo_dir/.run"
compose_file="$ecp_dir/deploy/compose.test.yaml"
mkdir -p "$run_dir"

docker compose -f "$compose_file" down --volumes --remove-orphans >/dev/null 2>&1 || true
docker compose -f "$compose_file" up -d --wait

docker compose -f "$compose_file" exec -T postgres psql -v ON_ERROR_STOP=1 -U ecp_migrator -d ecp_test \
  -c "DO \$\$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ecp_runtime') THEN CREATE ROLE ecp_runtime LOGIN PASSWORD 'ecp-runtime-test'; END IF; END \$\$; GRANT CONNECT ON DATABASE ecp_test TO ecp_runtime; GRANT USAGE ON SCHEMA public TO ecp_runtime; ALTER DEFAULT PRIVILEGES FOR ROLE ecp_migrator IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ecp_runtime;" >/dev/null
docker compose -f "$compose_file" exec -T mysql mysql -uroot -pecp-root-test \
  -e "CREATE USER IF NOT EXISTS 'ecp_runtime'@'%' IDENTIFIED BY 'ecp-runtime-test'; GRANT SELECT, INSERT, UPDATE, DELETE ON ecp_test.* TO 'ecp_runtime'@'%';" 2>/dev/null

umask 077
printf '%s\n' \
  'export ECP_TEST_POSTGRES_MIGRATION_DSN="postgres://ecp_migrator:ecp-migrator-test@127.0.0.1:55432/ecp_test?sslmode=disable"' \
  'export ECP_TEST_POSTGRES_RUNTIME_DSN="postgres://ecp_runtime:ecp-runtime-test@127.0.0.1:55432/ecp_test?sslmode=disable"' \
  'export ECP_TEST_MYSQL_MIGRATION_DSN="ecp_migrator:ecp-migrator-test@tcp(127.0.0.1:53306)/ecp_test?parseTime=true&multiStatements=true"' \
  'export ECP_TEST_MYSQL_RUNTIME_DSN="ecp_runtime:ecp-runtime-test@tcp(127.0.0.1:53306)/ecp_test?parseTime=true&multiStatements=true"' \
  > "$run_dir/test-db.env"

echo "ECP test databases are healthy"
