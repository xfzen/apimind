#!/bin/sh
set -eu

validation_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
. "$validation_root/lib/casdoor.sh"
trap casdoor_cleanup EXIT INT TERM

casdoor_setup
casdoor_login
casdoor_seed_enterprise

response_body=$(casdoor_post add-permission '{"owner":"ecp-gate0","name":"workspace-read","displayName":"Workspace read","users":["ecp-gate0/ecp-user"],"groups":[],"roles":[],"domains":[],"model":"built-in/user-model-built-in","resourceType":"Workspace","resources":["workspace:1"],"actions":["read"],"effect":"Allow","isEnabled":true,"state":"Approved","submitter":"admin","approver":"admin"}')
casdoor_assert_ok "$response_body"

allow_body=$(casdoor_post 'enforce?permissionId=ecp-gate0%2Fworkspace-read' '["ecp-gate0/ecp-user","workspace:1","read"]')
deny_body=$(casdoor_post 'enforce?permissionId=ecp-gate0%2Fworkspace-read' '["ecp-gate0/ecp-user","workspace:2","read"]')
test "$(printf '%s' "$allow_body" | jq -r '.data[0]')" = true
test "$(printf '%s' "$deny_body" | jq -r '.data[0]')" = false

response_body=$(casdoor_post add-role '{"owner":"ecp-gate0","name":"workspace-admin","displayName":"Workspace admin","users":["ecp-gate0/ecp-user"],"roles":[],"domains":[],"isEnabled":true}')
casdoor_assert_ok "$response_body"
response_body=$(casdoor_post add-permission '{"owner":"ecp-gate0","name":"workspace-admin-write","displayName":"Workspace admin write","users":[],"groups":[],"roles":["ecp-gate0/workspace-admin"],"domains":[],"model":"built-in/user-model-built-in","resourceType":"Workspace","resources":["workspace:1"],"actions":["write"],"effect":"Allow","isEnabled":true,"state":"Approved","submitter":"admin","approver":"admin"}')
casdoor_assert_ok "$response_body"
role_body=$(casdoor_post 'enforce?permissionId=ecp-gate0%2Fworkspace-admin-write' '["ecp-gate0/ecp-user","workspace:1","write"]')
test "$(printf '%s' "$role_body" | jq -r '.data[0]')" = true

batch_payload=$(jq -cn '[range(0;100) | if . % 2 == 0 then ["ecp-gate0/ecp-user","workspace:1","read"] else ["ecp-gate0/ecp-user","workspace:2","read"] end]')
start_ns=$(date +%s%N)
batch_body=$(casdoor_post 'batch-enforce?permissionId=ecp-gate0%2Fworkspace-read' "$batch_payload")
elapsed_ns=$(($(date +%s%N) - start_ns))
test "$(printf '%s' "$batch_body" | jq '[.data[0][]] | length')" = 100
test "$(printf '%s' "$batch_body" | jq '[.data[0][] | select(. == true)] | length')" = 50
printf 'casdoor policy prototype passed: batch=100 elapsed_ms=%s\n' "$((elapsed_ns / 1000000))"
