#!/bin/sh
set -eu

repo_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$repo_dir"
case "${ECP_DB_DRIVER:-}" in
  postgres|mysql) ;;
  *) echo "ECP_DB_DRIVER must be postgres or mysql" >&2; exit 1 ;;
esac
if [ -z "${ECP_MIGRATION_DSN:-}" ]; then
  echo "ECP_MIGRATION_DSN is required and must belong to the offline schema owner" >&2
  exit 1
fi
case "${1:-}" in
  up|version)
    test "$#" -eq 1
    ;;
  down)
    test "$#" -eq 1 || test "$#" -eq 2
    ;;
  *)
    echo "usage: migrate.sh up|down [steps]|version" >&2
    exit 1
    ;;
esac
GOWORK=off GOTOOLCHAIN=go1.25.12 go run ./cmd/migrate \
  -driver "$ECP_DB_DRIVER" -dsn "$ECP_MIGRATION_DSN" "$@"
