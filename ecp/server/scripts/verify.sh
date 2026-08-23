#!/bin/sh
set -eu

repo_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$repo_dir"
mkdir -p .run/go-build-cache
GOCACHE="$repo_dir/.run/go-build-cache"
export GOCACHE
./scripts/gencontracts.sh
GOWORK=off GOTOOLCHAIN=go1.25.12 go test ./...
GOWORK=off GOTOOLCHAIN=go1.25.12 go vet ./...
mkdir -p dist
GOWORK=off GOTOOLCHAIN=go1.25.12 go build -trimpath -o dist/ecp-api ./api
