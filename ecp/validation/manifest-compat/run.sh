#!/bin/sh
set -eu

prototype_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
command -v node >/dev/null
node_major=$(node -p 'process.versions.node.split(".")[0]')
test "$node_major" -ge 24
node "$prototype_dir/run.mjs" "$prototype_dir/v0.yaml" "$prototype_dir/v1.yaml"
