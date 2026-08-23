#!/bin/sh
set -eu

prototype_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
ecp_dir=$(CDPATH= cd -- "$prototype_dir/../.." && pwd)
postgres_image=$(jq -r '.images.postgres.reference' "$ecp_dir/versions.lock.yaml")
mysql_image=$(jq -r '.images.mysql.reference' "$ecp_dir/versions.lock.yaml")

cleanup() {
  docker rm -f ecp-gate0-postgres ecp-gate0-migration-mysql >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM
cleanup

docker run -d --name ecp-gate0-postgres \
  -e POSTGRES_PASSWORD=ecp-gate0 -e POSTGRES_DB=ecp_gate0 \
  "$postgres_image" >/dev/null
docker run -d --name ecp-gate0-migration-mysql \
  -e MYSQL_ROOT_PASSWORD=ecp-gate0 -e MYSQL_DATABASE=ecp_gate0 \
  "$mysql_image" >/dev/null

postgres_ready=0
mysql_ready=0
for probe_iteration in 1 2 3 4 5 6 7 8 9 10 11 12; do
  if docker exec ecp-gate0-postgres pg_isready -U postgres -d ecp_gate0 >/dev/null 2>&1; then postgres_ready=1; fi
  if docker exec ecp-gate0-migration-mysql mysqladmin ping -h127.0.0.1 -pecp-gate0 >/dev/null 2>&1; then mysql_ready=1; fi
  if [ "$postgres_ready" = 1 ] && [ "$mysql_ready" = 1 ]; then break; fi
  sleep 5
done
test "$postgres_ready" = 1
test "$mysql_ready" = 1

docker exec -i ecp-gate0-postgres psql -v ON_ERROR_STOP=1 -U postgres -d ecp_gate0 < "$prototype_dir/postgres.sql" >/dev/null
docker exec -i ecp-gate0-migration-mysql mysql -uroot -pecp-gate0 ecp_gate0 < "$prototype_dir/mysql.sql" 2>/dev/null

docker exec ecp-gate0-postgres psql -v ON_ERROR_STOP=1 -U postgres -d ecp_gate0 -c "INSERT INTO ecp_gate0_records(enterprise_id, external_id) VALUES ('ent-1','ext-1')" >/dev/null
docker exec ecp-gate0-postgres psql -v ON_ERROR_STOP=1 -U postgres -d ecp_gate0 -c "BEGIN; INSERT INTO ecp_gate0_records(enterprise_id, external_id) VALUES ('ent-1','rollback'); ROLLBACK;" >/dev/null
test "$(docker exec ecp-gate0-postgres psql -At -U postgres -d ecp_gate0 -c "SELECT count(*) FROM ecp_gate0_records WHERE external_id='rollback'")" = 0
if docker exec ecp-gate0-postgres psql -v ON_ERROR_STOP=1 -U postgres -d ecp_gate0 -c "INSERT INTO ecp_gate0_records(enterprise_id, external_id) VALUES ('ent-1','ext-1')" >/dev/null 2>&1; then
  echo "PostgreSQL compound unique constraint did not reject duplicate" >&2
  exit 1
fi
docker exec ecp-gate0-postgres sh -c "PGPASSWORD=ecp-gate0-runtime psql -h 127.0.0.1 -At -U ecp_runtime -d ecp_gate0 -c 'SELECT count(*) FROM ecp_gate0_records'" | grep -qx 1

docker exec ecp-gate0-migration-mysql mysql -uroot -pecp-gate0 ecp_gate0 -e "INSERT INTO ecp_gate0_records(enterprise_id, external_id) VALUES ('ent-1','ext-1'); START TRANSACTION; INSERT INTO ecp_gate0_records(enterprise_id, external_id) VALUES ('ent-1','rollback'); ROLLBACK;" 2>/dev/null
test "$(docker exec ecp-gate0-migration-mysql mysql -N -uroot -pecp-gate0 ecp_gate0 -e "SELECT count(*) FROM ecp_gate0_records WHERE external_id='rollback'" 2>/dev/null)" = 0
if docker exec ecp-gate0-migration-mysql mysql -uroot -pecp-gate0 ecp_gate0 -e "INSERT INTO ecp_gate0_records(enterprise_id, external_id) VALUES ('ent-1','ext-1')" >/dev/null 2>&1; then
  echo "MySQL compound unique constraint did not reject duplicate" >&2
  exit 1
fi
docker exec ecp-gate0-migration-mysql mysql -N -h127.0.0.1 -uecp_runtime -pecp-gate0-runtime ecp_gate0 -e 'SELECT count(*) FROM ecp_gate0_records' 2>/dev/null | grep -qx 1

docker exec ecp-gate0-postgres psql -v ON_ERROR_STOP=1 -U postgres -d ecp_gate0 -c 'DROP TABLE ecp_gate0_records' >/dev/null
docker exec ecp-gate0-migration-mysql mysql -uroot -pecp-gate0 ecp_gate0 -e 'DROP TABLE ecp_gate0_records' 2>/dev/null
docker exec -i ecp-gate0-postgres psql -v ON_ERROR_STOP=1 -U postgres -d ecp_gate0 < "$prototype_dir/postgres.sql" >/dev/null
docker exec -i ecp-gate0-migration-mysql mysql -uroot -pecp-gate0 ecp_gate0 < "$prototype_dir/mysql.sql" 2>/dev/null

test "$(docker exec ecp-gate0-postgres psql -At -U postgres -d ecp_gate0 -c "SELECT datetime_precision FROM information_schema.columns WHERE table_name='ecp_gate0_records' AND column_name='created_at'")" = 6
test "$(docker exec ecp-gate0-migration-mysql mysql -N -uroot -pecp-gate0 information_schema -e "SELECT datetime_precision FROM columns WHERE table_schema='ecp_gate0' AND table_name='ecp_gate0_records' AND column_name='created_at'" 2>/dev/null)" = 6

echo "dual-dialect migration prototype passed"
