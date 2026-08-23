#!/bin/sh
set -eu

validation_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
ecp_dir=$(CDPATH= cd -- "$validation_root/.." && pwd)
. "$validation_root/lib/casdoor.sh"
postgres_image=$(jq -r '.images.postgres.reference' "$ecp_dir/versions.lock.yaml")
backup_dir=$(mktemp -d "${TMPDIR:-/tmp}/ecp-gate0-backup.XXXXXX")

cleanup_all() {
  docker rm -f ecp-gate0-backup-postgres >/dev/null 2>&1 || true
  casdoor_cleanup
  rm -rf "$backup_dir"
}
trap cleanup_all EXIT INT TERM

casdoor_setup
casdoor_login
casdoor_seed_enterprise
response_body=$(casdoor_post add-permission '{"owner":"ecp-gate0","name":"workspace-read","displayName":"Workspace read","users":["ecp-gate0/ecp-user"],"groups":[],"roles":[],"domains":[],"model":"built-in/user-model-built-in","resourceType":"Workspace","resources":["workspace:1"],"actions":["read"],"effect":"Allow","isEnabled":true,"state":"Approved","submitter":"admin","approver":"admin"}')
casdoor_assert_ok "$response_body"

docker exec ecp-gate0-mysql mysql -uroot -pecp-gate0 -e "CREATE DATABASE product_fixture; CREATE TABLE product_fixture.resources(id BIGINT AUTO_INCREMENT PRIMARY KEY, stable_ref VARCHAR(128) NOT NULL UNIQUE, body JSON NOT NULL); INSERT INTO product_fixture.resources(stable_ref, body) VALUES ('workspace:1', JSON_OBJECT('name','Workspace One'));" 2>/dev/null

docker run -d --name ecp-gate0-backup-postgres \
  -e POSTGRES_PASSWORD=ecp-gate0 -e POSTGRES_DB=ecp_gate0 \
  "$postgres_image" >/dev/null
postgres_ready=0
for probe_iteration in 1 2 3 4 5 6 7 8 9 10 11 12; do
  if docker exec ecp-gate0-backup-postgres pg_isready -U postgres -d ecp_gate0 >/dev/null 2>&1; then postgres_ready=1; break; fi
  sleep 5
done
test "$postgres_ready" = 1
docker exec ecp-gate0-backup-postgres psql -v ON_ERROR_STOP=1 -U postgres -d ecp_gate0 -c "CREATE TABLE identity_mappings(id BIGSERIAL PRIMARY KEY, issuer TEXT NOT NULL, subject TEXT NOT NULL, UNIQUE(issuer,subject)); CREATE TABLE policy_projections(id BIGSERIAL PRIMARY KEY, resource_ref TEXT NOT NULL, action TEXT NOT NULL); INSERT INTO identity_mappings(issuer,subject) VALUES ('http://casdoor','ecp-stable-001'); INSERT INTO policy_projections(resource_ref,action) VALUES ('workspace:1','read');" >/dev/null

# Short read-only window: stop the Casdoor writer before coordinated dumps.
docker stop ecp-gate0-casdoor >/dev/null
docker exec ecp-gate0-mysql mysqldump -uroot -pecp-gate0 --single-transaction --databases casdoor > "$backup_dir/casdoor.sql" 2>/dev/null
docker exec ecp-gate0-mysql mysqldump -uroot -pecp-gate0 --single-transaction --databases product_fixture > "$backup_dir/product.sql" 2>/dev/null
docker exec ecp-gate0-backup-postgres pg_dump -U postgres -d ecp_gate0 --clean --if-exists > "$backup_dir/ecp.sql"
test -s "$backup_dir/casdoor.sql"
test -s "$backup_dir/product.sql"
test -s "$backup_dir/ecp.sql"

docker exec ecp-gate0-mysql mysql -uroot -pecp-gate0 -e 'DROP DATABASE casdoor; DROP DATABASE product_fixture;' 2>/dev/null
docker exec -i ecp-gate0-mysql mysql -uroot -pecp-gate0 < "$backup_dir/casdoor.sql" 2>/dev/null
docker exec -i ecp-gate0-mysql mysql -uroot -pecp-gate0 < "$backup_dir/product.sql" 2>/dev/null
docker exec ecp-gate0-backup-postgres psql -v ON_ERROR_STOP=1 -U postgres -d ecp_gate0 -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;' >/dev/null
docker exec -i ecp-gate0-backup-postgres psql -v ON_ERROR_STOP=1 -U postgres -d ecp_gate0 < "$backup_dir/ecp.sql" >/dev/null

test "$(docker exec ecp-gate0-mysql mysql -N -uroot -pecp-gate0 casdoor -e "SELECT count(*) FROM user WHERE external_id='ecp-stable-001'" 2>/dev/null)" = 1
test "$(docker exec ecp-gate0-mysql mysql -N -uroot -pecp-gate0 casdoor -e "SELECT count(*) FROM permission WHERE name='workspace-read'" 2>/dev/null)" = 1
test "$(docker exec ecp-gate0-mysql mysql -N -uroot -pecp-gate0 product_fixture -e "SELECT count(*) FROM resources WHERE stable_ref='workspace:1'" 2>/dev/null)" = 1
test "$(docker exec ecp-gate0-backup-postgres psql -At -U postgres -d ecp_gate0 -c "SELECT count(*) FROM identity_mappings WHERE subject='ecp-stable-001'")" = 1
restored_id=$(docker exec ecp-gate0-backup-postgres psql -At -U postgres -d ecp_gate0 -c "INSERT INTO identity_mappings(issuer,subject) VALUES ('http://casdoor','ecp-stable-002') RETURNING id" | head -n 1)
test "$restored_id" = 2

docker start ecp-gate0-casdoor >/dev/null
casdoor_ready=0
for probe_iteration in 1 2 3 4 5 6 7 8 9 10 11 12; do
  probe_http=$(curl -sS -o /dev/null -w '%{http_code}' http://127.0.0.1:18000/api/get-account 2>/dev/null || true)
  if [ "$probe_http" = 200 ]; then casdoor_ready=1; break; fi
  sleep 5
done
test "$casdoor_ready" = 1
casdoor_login
restored_user=$(casdoor_get 'get-user?id=ecp-gate0%2Fecp-user')
test "$(printf '%s' "$restored_user" | jq -r '.data.externalId')" = ecp-stable-001

echo "coordinated empty-environment backup/restore prototype passed"
