#!/bin/sh
set -eu

root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$root"

git submodule sync -- server
git submodule update --init --checkout --depth 1 -- server
node web/scripts/generate-plugin-module.js
node scripts/ensure-yapi-compat-alias.mjs --root "$root"

echo "ApiMind workspace initialized at the pinned Server commit."
