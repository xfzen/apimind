#!/bin/sh
set -eu

repo_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
: "${ECP_DB_DRIVER:?ECP_DB_DRIVER is required}"
: "${ECP_MIGRATION_DSN:?ECP_MIGRATION_DSN is required}"
: "${ECP_SCHEMA_OWNER_PASSWORD:?ECP_SCHEMA_OWNER_PASSWORD is required}"
: "${ECP_TX_WRITER_PASSWORD:?ECP_TX_WRITER_PASSWORD is required}"
: "${ECP_AUDIT_INGEST_PASSWORD:?ECP_AUDIT_INGEST_PASSWORD is required}"
: "${ECP_AUDIT_READER_PASSWORD:?ECP_AUDIT_READER_PASSWORD is required}"
: "${ECP_AUDIT_MAINTAINER_PASSWORD:?ECP_AUDIT_MAINTAINER_PASSWORD is required}"
cd "$repo_dir"
mkdir -p .run/go-build-cache
GOCACHE="$repo_dir/.run/go-build-cache" GOWORK=off GOTOOLCHAIN=go1.25.12 go run ./cmd/audit-bootstrap bootstrap
echo "audit roles bootstrapped"
