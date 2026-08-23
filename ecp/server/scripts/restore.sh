#!/bin/sh
set -eu

[ "${1:-}" = "--empty-target" ] || { echo "restore requires --empty-target" >&2; exit 1; }
backup_dir=${2:?usage: restore.sh --empty-target BACKUP_DIR}
server_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$server_dir"
verified=$(go run ./cmd/backup-manifest --manifest "$backup_dir/manifest.json")
[ "$verified" = verified ] || { echo "manifest.json sha256 verification failed" >&2; exit 1; }
test "${ECP_RESTORE_TARGET_EMPTY:?set ECP_RESTORE_TARGET_EMPTY}" = true
assert_postgres_empty() {
	dsn=$1
	count=$(psql "$dsn" -Atqc "SELECT count(*) FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog', 'information_schema')")
	[ "$count" = 0 ] || { echo "restore target PostgreSQL database is not empty" >&2; exit 1; }
}
assert_mongo_empty() {
	uri=$1
	count=$(mongosh "$uri" --quiet --eval 'db.getCollectionNames().filter(function (name) { return !name.startsWith("system."); }).length')
	[ "$count" = 0 ] || { echo "restore target MongoDB database is not empty" >&2; exit 1; }
}
assert_postgres_empty "${CASDOOR_RESTORE_DSN:?set CASDOOR_RESTORE_DSN}"
assert_postgres_empty "${ECP_RESTORE_DSN:?set ECP_RESTORE_DSN}"
assert_mongo_empty "${APIMIND_RESTORE_MONGO_URI:?set APIMIND_RESTORE_MONGO_URI}"
pg_restore --exit-on-error --no-owner --dbname "$CASDOOR_RESTORE_DSN" "$backup_dir/casdoor.dump"
pg_restore --exit-on-error --no-owner --dbname "$ECP_RESTORE_DSN" "$backup_dir/ecp.dump"
mongorestore --uri="$APIMIND_RESTORE_MONGO_URI" --archive="$backup_dir/apimind.archive" --gzip
backup_id=$(sed -n 's/.*"backup_id": "\([^"]*\)".*/\1/p' "$backup_dir/manifest.json" | head -n 1)
started_at=$(sed -n 's/.*"created_at": "\([^"]*\)".*/\1/p' "$backup_dir/manifest.json" | head -n 1)
manifest_hash=$(shasum -a 256 "$backup_dir/manifest.json" | awk '{print $1}')
go run ./cmd/backup-status --driver "${ECP_DATABASE_DRIVER:-postgres}" --dsn-file "${ECP_RESTORE_DSN_FILE:?set ECP_RESTORE_DSN_FILE}" --enterprise "${ECP_ENTERPRISE_ID:?set ECP_ENTERPRISE_ID}" --backup "$backup_id" --state verified --manifest-hash "$manifest_hash" --started-at "$started_at"
echo "verified empty-target restore completed"
