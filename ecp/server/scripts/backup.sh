#!/bin/sh
set -eu

server_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
output_dir=${1:?usage: backup.sh OUTPUT_DIR}
backup_id=${ECP_BACKUP_ID:-$(date -u +%Y%m%dT%H%M%SZ)}
started_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)
mkdir -p "$output_dir"
chmod 700 "$output_dir"
output_dir=$(CDPATH= cd -- "$output_dir" && pwd)

record_status() {
	state=$1
	reason=${2:-}
	cd "$server_dir"
	go run ./cmd/backup-status --driver "${ECP_DATABASE_DRIVER:-postgres}" --dsn-file "${ECP_DATABASE_DSN_FILE:?set ECP_DATABASE_DSN_FILE}" --enterprise "${ECP_ENTERPRISE_ID:?set ECP_ENTERPRISE_ID}" --backup "$backup_id" --state "$state" --reason "$reason" --started-at "$started_at"
}

backup_failed() {
	trap - EXIT INT TERM
	record_status failed backup_command_failed || true
	exit 1
}

trap backup_failed EXIT INT TERM
record_status in_progress

pg_dump --format=custom --file="$output_dir/casdoor.dump" "${CASDOOR_DATABASE_DSN:?set CASDOOR_DATABASE_DSN}"
pg_dump --format=custom --file="$output_dir/ecp.dump" "${ECP_DATABASE_DSN:?set ECP_DATABASE_DSN}"
mongodump --uri="${APIMIND_MONGO_URI:?set APIMIND_MONGO_URI}" --archive="$output_dir/apimind.archive" --gzip
cd "$server_dir"
go run ./cmd/backup-manifest --dir "$output_dir" --output "$output_dir/manifest.json" --backup-id "$backup_id" --ecp-version "${ECP_VERSION:-dev}" --apimind-version "${APIMIND_VERSION:-dev}" --encryption "${ECP_BACKUP_ENCRYPTION:-external}"
manifest_hash=$(shasum -a 256 "$output_dir/manifest.json" | awk '{print $1}')
go run ./cmd/backup-status --driver "${ECP_DATABASE_DRIVER:-postgres}" --dsn-file "${ECP_DATABASE_DSN_FILE:?set ECP_DATABASE_DSN_FILE}" --enterprise "${ECP_ENTERPRISE_ID:?set ECP_ENTERPRISE_ID}" --backup "$backup_id" --state completed --manifest-hash "$manifest_hash" --started-at "$started_at"
trap - EXIT INT TERM
echo "backup completed but remains unverified until an empty-target restore succeeds: $output_dir"
