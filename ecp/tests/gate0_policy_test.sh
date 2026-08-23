#!/bin/sh
set -eu

ecp_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)

test -x "$ecp_dir/scripts/verify-inputs.sh"
test -x "$ecp_dir/scripts/verify-prototypes.sh"

"$ecp_dir/scripts/verify-inputs.sh"
"$ecp_dir/scripts/verify-prototypes.sh"

tmp_dir=$(mktemp -d "${TMPDIR:-/tmp}/ecp-gate0-policy.XXXXXX")
trap 'rm -rf "$tmp_dir"' EXIT INT TERM

cp -R "$ecp_dir" "$tmp_dir/ecp"
sed 's/casbin\/casdoor:3.154.4@sha256:[0-9a-f]\{64\}/casbin\/casdoor:latest/' \
  "$tmp_dir/ecp/versions.lock.yaml" > "$tmp_dir/ecp/versions.lock.yaml.tmp"
mv "$tmp_dir/ecp/versions.lock.yaml.tmp" "$tmp_dir/ecp/versions.lock.yaml"

if "$tmp_dir/ecp/scripts/verify-inputs.sh" >/dev/null 2>&1; then
  echo "verify-inputs accepted a floating image tag" >&2
  exit 1
fi

cp -R "$ecp_dir" "$tmp_dir/ecp-unofficial"
sed 's#https://github.com/zeromicro/goctl-swagger#https://example.invalid/goctl-swagger#' \
  "$tmp_dir/ecp-unofficial/versions.lock.yaml" > "$tmp_dir/ecp-unofficial/versions.lock.yaml.tmp"
mv "$tmp_dir/ecp-unofficial/versions.lock.yaml.tmp" "$tmp_dir/ecp-unofficial/versions.lock.yaml"
if "$tmp_dir/ecp-unofficial/scripts/verify-inputs.sh" >/dev/null 2>&1; then
  echo "verify-inputs accepted an unofficial Go module origin" >&2
  exit 1
fi

cp -R "$ecp_dir" "$tmp_dir/ecp-missing-sum"
sed '/github.com\/zeromicro\/goctl-swagger v0.2.0 h1:/d' \
  "$tmp_dir/ecp-missing-sum/tools/go.sum" > "$tmp_dir/ecp-missing-sum/tools/go.sum.tmp"
mv "$tmp_dir/ecp-missing-sum/tools/go.sum.tmp" "$tmp_dir/ecp-missing-sum/tools/go.sum"
if "$tmp_dir/ecp-missing-sum/scripts/verify-inputs.sh" >/dev/null 2>&1; then
  echo "verify-inputs accepted a missing generator checksum" >&2
  exit 1
fi

echo "gate0 policy tests passed"
