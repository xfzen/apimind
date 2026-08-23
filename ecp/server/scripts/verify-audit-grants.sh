#!/bin/sh
set -eu

repo_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$repo_dir"
mkdir -p .run/go-build-cache
GOCACHE="$repo_dir/.run/go-build-cache" GOWORK=off GOTOOLCHAIN=go1.25.12 go test ./internal/service/audit -run TestAuditRoleGrants -count=1 -p 1
