#!/bin/sh
set -eu

ecp_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
lock_file="$ecp_dir/versions.lock.yaml"
tools_dir="$ecp_dir/tools"

command -v jq >/dev/null
test -f "$lock_file"
jq -e '.schema_version == 1 and .verified_at != null' "$lock_file" >/dev/null
jq -e '.registries == {"go_proxy":"https://proxy.golang.org","npm":"https://registry.npmjs.org","docker":"https://registry-1.docker.io"}' "$lock_file" >/dev/null
jq -e '
  [.toolchains[] | select((.version | test("^(latest|main|master|dev)$")) or (.source | test("^https://") | not) or (.sha256 | test("^[0-9a-f]{64}$") | not))] | length == 0
' "$lock_file" >/dev/null
jq -e '
  [.go_modules[] | select((.version | test("^v[0-9]+\\.[0-9]+\\.[0-9]+([-.].+)?$") | not) or (.source | test("^https://github.com/(zeromicro|go-gorm|golang-migrate|coreos|golang)/" ) | not) or (.sum | test("^h1:" ) | not))] | length == 0
' "$lock_file" >/dev/null
jq -e '
  [.npm_packages[] | select((.version | test("^[0-9]+\\.[0-9]+\\.[0-9]+([-.].+)?$") | not) or (.integrity | test("^sha512-") | not))] | length == 0
' "$lock_file" >/dev/null
jq -e '
  [.images[] | select((.reference | test("^[^:@]+(?:/[^:@]+)*:[0-9]+\\.[0-9]+(?:\\.[0-9]+)?@sha256:[0-9a-f]{64}$") | not) or (.source | test("^https://hub.docker.com/") | not) or (.architectures != ["linux/amd64", "linux/arm64"]) or ([.platform_digests[] | test("^sha256:[0-9a-f]{64}$")] | all | not))] | length == 0
' "$lock_file" >/dev/null

test "$(jq -r '.toolchains.go.version' "$lock_file")" = "1.25.12"
test "$(jq -r '.go_modules["github.com/zeromicro/go-zero/tools/goctl"].version' "$lock_file")" = "v1.9.2"
test "$(jq -r '.go_modules["github.com/zeromicro/goctl-swagger"].version' "$lock_file")" = "v0.2.0"
grep -Fq 'go 1.25.12' "$tools_dir/go.mod"
grep -Fq 'github.com/zeromicro/go-zero/tools/goctl v1.9.2' "$tools_dir/go.mod"
grep -Fq 'github.com/zeromicro/goctl-swagger v0.2.0' "$tools_dir/go.mod"
grep -Fq 'google.golang.org/genproto/googleapis/api v0.0.0-20240711142825-46eb208f015d' "$tools_dir/go.mod"
grep -Fq 'google.golang.org/genproto/googleapis/rpc v0.0.0-20240711142825-46eb208f015d' "$tools_dir/go.mod"
grep -Fq 'github.com/zeromicro/go-zero/tools/goctl v1.9.2 h1:SCgx7BlN0Rce3J4R77AWqmp6KWCyBlAZUwlYjBOOn2Y=' "$tools_dir/go.sum"
grep -Fq 'github.com/zeromicro/goctl-swagger v0.2.0 h1:NHjRV6IUYVS2HQTDsvZdrj2Yt0XV3WXbaQS9BpWuDpI=' "$tools_dir/go.sum"

if [ -f "$ecp_dir/server/go.mod" ]; then
  for module_spec in \
    'github.com/zeromicro/go-zero v1.10.2' \
    'github.com/golang-migrate/migrate/v4 v4.19.1' \
    'github.com/coreos/go-oidc/v3 v3.20.0' \
    'golang.org/x/oauth2 v0.36.0' \
    'gorm.io/gorm v1.31.2' \
    'gorm.io/driver/postgres v1.6.2' \
    'gorm.io/driver/mysql v1.6.0'; do
    grep -Fq "$module_spec" "$ecp_dir/server/go.mod"
  done
fi

if [ -f "$ecp_dir/ui/package.json" ]; then
  ui_package="$ecp_dir/ui/package.json"
  ui_lock="$ecp_dir/ui/package-lock.json"
  test -f "$ui_lock"
  test "$(jq -r '.engines.node' "$ui_package")" = "$(jq -r '.toolchains.node.version' "$lock_file")"
  test "$(jq -r '.packageManager' "$ui_package")" = "npm@$(jq -r '.toolchains.node.npm_version' "$lock_file")"
  jq -e --slurpfile inputs "$lock_file" '
    . as $package
    | $inputs[0].npm_packages
    | to_entries
    | all(.[]; (($package.dependencies[.key] // $package.devDependencies[.key]) == .value.version))
  ' "$ui_package" >/dev/null
  jq -e --slurpfile inputs "$lock_file" '
    . as $package_lock
    | $inputs[0].npm_packages
    | to_entries
    | all(.[];
        ($package_lock.packages[("node_modules/" + .key)].version == .value.version)
        and ($package_lock.packages[("node_modules/" + .key)].integrity == .value.integrity))
  ' "$ui_lock" >/dev/null
  jq -e --slurpfile package "$ui_package" '
    .lockfileVersion == 3
    and .packages[""].dependencies == $package[0].dependencies
    and .packages[""].devDependencies == $package[0].devDependencies
    and .packages[""].engines == $package[0].engines
  ' "$ui_lock" >/dev/null
fi

if [ "${ECP_VERIFY_LOCAL_IMAGES:-0}" = 1 ]; then
  command -v docker >/dev/null
  for image_key in casdoor postgres mysql; do
    image_ref=$(jq -r ".images.$image_key.reference" "$lock_file")
    expected_digest=${image_ref##*@}
    docker image inspect "$image_ref" --format '{{join .RepoDigests "\n"}}' | grep -Fq "@$expected_digest"
  done
fi

echo "frozen input verification passed"
