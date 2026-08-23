#!/bin/sh
set -eu

validation_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
. "$validation_root/lib/casdoor.sh"
trap casdoor_cleanup EXIT INT TERM

casdoor_setup
casdoor_login
casdoor_seed_enterprise

user_body=$(casdoor_get 'get-user?id=ecp-gate0%2Fecp-user')
test "$(printf '%s' "$user_body" | jq -r '.data.externalId')" = ecp-stable-001

response_body=$(casdoor_post add-group '{"owner":"ecp-gate0","name":"developers","displayName":"Developers","type":"Virtual"}')
casdoor_assert_ok "$response_body"
updated_user=$(printf '%s' "$user_body" | jq -c '.data | .groups=["ecp-gate0/developers"]')
response_body=$(casdoor_post 'update-user?id=ecp-gate0%2Fecp-user' "$updated_user")
casdoor_assert_ok "$response_body"
user_body=$(casdoor_get 'get-user?id=ecp-gate0%2Fecp-user')
test "$(printf '%s' "$user_body" | jq -r '.data.groups[0]')" = ecp-gate0/developers

updated_user=$(printf '%s' "$user_body" | jq -c '.data | .isForbidden=true')
response_body=$(casdoor_post 'update-user?id=ecp-gate0%2Fecp-user' "$updated_user")
casdoor_assert_ok "$response_body"
user_body=$(casdoor_get 'get-user?id=ecp-gate0%2Fecp-user')
test "$(printf '%s' "$user_body" | jq -r '.data.isForbidden')" = true
test "$(printf '%s' "$user_body" | jq -r '.data.externalId')" = ecp-stable-001

poll_body=$(casdoor_get 'get-users?owner=ecp-gate0')
test "$(printf '%s' "$poll_body" | jq '[.data[] | select(.externalId == "ecp-stable-001" and .isForbidden == true)] | length')" = 1

reserved_body=$(casdoor_post add-user '{"owner":"built-in","name":"forbidden-gate0-user","displayName":"Must fail","password":"not-used","type":"normal-user"}')
test "$(printf '%s' "$reserved_body" | jq -r '.status')" = error
printf '%s' "$reserved_body" | jq -er '.msg | contains("currently disabled")' >/dev/null

admin_body=$(casdoor_get 'get-user?id=built-in%2Fadmin')
test "$(printf '%s' "$admin_body" | jq -r '.data.name')" = admin

response_body=$(casdoor_post 'delete-user?id=ecp-gate0%2Fecp-user' "$(printf '%s' "$user_body" | jq -c '.data')")
casdoor_assert_ok "$response_body"
deleted_body=$(casdoor_get 'get-user?id=ecp-gate0%2Fecp-user')
test "$(printf '%s' "$deleted_body" | jq -r '.data == null')" = true

echo "casdoor lifecycle prototype passed"
