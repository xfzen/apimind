#!/bin/sh
set -eu

repo_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
ecp_dir=$(CDPATH= cd -- "$repo_dir/.." && pwd)
docker compose -f "$ecp_dir/deploy/compose.test.yaml" down --volumes --remove-orphans
rm -f "$repo_dir/.run/test-db.env"
