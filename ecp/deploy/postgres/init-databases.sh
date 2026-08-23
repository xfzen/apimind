#!/bin/sh
set -eu

casdoor_password=$(cat "$CASDOOR_DB_PASSWORD_FILE")
ecp_password=$(cat "$ECP_DB_PASSWORD_FILE")
psql --set ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres \
  --set=casdoor_password="$casdoor_password" --set=ecp_password="$ecp_password" <<'SQL'
CREATE ROLE casdoor_runtime LOGIN PASSWORD :'casdoor_password';
CREATE DATABASE casdoor_db OWNER casdoor_runtime;
CREATE ROLE ecp_schema_owner LOGIN PASSWORD :'ecp_password';
CREATE DATABASE ecp_db OWNER ecp_schema_owner;
SQL
