#!/bin/sh

validation_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
ecp_root=$(CDPATH= cd -- "$validation_root/.." && pwd)
casdoor_image=$(jq -r '.images.casdoor.reference' "$ecp_root/versions.lock.yaml")
mysql_image=$(jq -r '.images.mysql.reference' "$ecp_root/versions.lock.yaml")
casdoor_cookie_file="${TMPDIR:-/tmp}/ecp-gate0-casdoor.cookies"

casdoor_cleanup() {
  docker rm -f ecp-gate0-casdoor ecp-gate0-mysql >/dev/null 2>&1 || true
  docker network rm ecp-gate0-casdoor >/dev/null 2>&1 || true
  rm -f "$casdoor_cookie_file"
}

casdoor_setup() {
  casdoor_cleanup
  docker network create ecp-gate0-casdoor >/dev/null
  docker run -d --name ecp-gate0-mysql \
    --network ecp-gate0-casdoor --network-alias ecp-gate0-mysql \
    -e MYSQL_ROOT_PASSWORD=ecp-gate0 -e MYSQL_DATABASE=casdoor \
    "$mysql_image" >/dev/null

  probe_ready=0
  for probe_iteration in 1 2 3 4 5 6 7 8 9 10 11 12; do
    if docker exec ecp-gate0-mysql mysqladmin ping -h127.0.0.1 -pecp-gate0 >/dev/null 2>&1; then
      probe_ready=1
      break
    fi
    sleep 5
  done
  test "$probe_ready" = 1

  docker run -d --name ecp-gate0-casdoor \
    --network ecp-gate0-casdoor -p 18000:8000 \
    -v "$validation_root/lib/casdoor-app.conf:/conf/app.conf:ro" \
    "$casdoor_image" >/dev/null

  probe_ready=0
  for probe_iteration in 1 2 3 4 5 6 7 8 9 10 11 12; do
    probe_http=$(curl -sS -o /dev/null -w '%{http_code}' http://127.0.0.1:18000/api/get-account 2>/dev/null || true)
    if [ "$probe_http" = 200 ]; then
      probe_ready=1
      break
    fi
    sleep 5
  done
  test "$probe_ready" = 1
}

casdoor_login() {
  login_response=$(curl -sS -c "$casdoor_cookie_file" -H 'Content-Type: application/json' \
    -X POST http://127.0.0.1:18000/api/login \
    --data '{"type":"login","application":"app-built-in","organization":"built-in","username":"admin","password":"123","signinMethod":"Password"}')
  test "$(printf '%s' "$login_response" | jq -r '.status')" = ok
  test "$(printf '%s' "$login_response" | jq -r '.data')" = built-in/admin
}

casdoor_post() {
  endpoint_name=$1
  payload=$2
  curl -sS -b "$casdoor_cookie_file" -H 'Content-Type: application/json' \
    -X POST "http://127.0.0.1:18000/api/$endpoint_name" --data "$payload"
}

casdoor_get() {
  endpoint_name=$1
  curl -sS -b "$casdoor_cookie_file" "http://127.0.0.1:18000/api/$endpoint_name"
}

casdoor_assert_ok() {
  response_body=$1
  test "$(printf '%s' "$response_body" | jq -r '.status')" = ok
}

casdoor_seed_enterprise() {
  response_body=$(casdoor_post add-organization '{"owner":"admin","name":"ecp-gate0","displayName":"ECP Gate 0","passwordType":"plain","defaultPassword":"gate0-password","languages":["en"],"hasPrivilegeConsent":false}')
  casdoor_assert_ok "$response_body"
  response_body=$(casdoor_post add-application '{"owner":"admin","name":"app-ecp-gate0","displayName":"ECP Gate 0","organization":"ecp-gate0","redirectUris":["http://127.0.0.1:18000/callback"],"grantTypes":["authorization_code"],"signinMethods":[{"name":"Password","displayName":"Password","rule":"All"}]}')
  casdoor_assert_ok "$response_body"
  response_body=$(casdoor_post add-user '{"owner":"ecp-gate0","name":"ecp-user","displayName":"ECP User","email":"ecp-gate0@example.invalid","password":"gate0-password","type":"normal-user","externalId":"ecp-stable-001","groups":[]}')
  casdoor_assert_ok "$response_body"
}
