#!/bin/sh
set -eu

ecp_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
"$ecp_dir/scripts/verify-inputs.sh"

tmp_dir=$(mktemp -d "${TMPDIR:-/tmp}/ecp-gate0-standalone.XXXXXX")
trap 'rm -rf "$tmp_dir"' EXIT INT TERM
mkdir -p "$tmp_dir/ecp/scripts"
cp "$ecp_dir/versions.lock.yaml" "$tmp_dir/ecp/versions.lock.yaml"
cp -R "$ecp_dir/tools" "$tmp_dir/ecp/tools"
cp -R "$ecp_dir/validation" "$tmp_dir/ecp/validation"
cp "$ecp_dir/scripts/verify-inputs.sh" "$tmp_dir/ecp/scripts/verify-inputs.sh"
cp "$ecp_dir/scripts/verify-prototypes.sh" "$tmp_dir/ecp/scripts/verify-prototypes.sh"
"$tmp_dir/ecp/scripts/verify-inputs.sh"

if [ "${ECP_STATIC_ONLY:-0}" != 1 ]; then
  ECP_VERIFY_LOCAL_IMAGES=1 "$tmp_dir/ecp/scripts/verify-inputs.sh"
  for prototype in casdoor-policy casdoor-lifecycle manifest-compat dialect-migration backup-restore; do
    "$tmp_dir/ecp/validation/$prototype/run.sh"
  done
fi

echo "Gate 0 standalone prototype verification passed"
