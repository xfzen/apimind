CREATE TABLE login_transactions (
  id VARCHAR(36) PRIMARY KEY,
  enterprise_id VARCHAR(36) NOT NULL REFERENCES enterprises(enterprise_id),
  oidc_client_id VARCHAR(36) NOT NULL REFERENCES oidc_clients(id),
  application_instance_id VARCHAR(36) REFERENCES application_instances(id),
  kind VARCHAR(32) NOT NULL CHECK (kind IN ('admin', 'product')),
  state_hash CHAR(64) NOT NULL UNIQUE,
  pkce_verifier_hash CHAR(64) NOT NULL,
  nonce_hash CHAR(64) NOT NULL,
  redirect_uri VARCHAR(512) NOT NULL,
  expires_at TIMESTAMPTZ(6) NOT NULL,
  used_at TIMESTAMPTZ(6),
  created_at TIMESTAMPTZ(6) NOT NULL,
  updated_at TIMESTAMPTZ(6) NOT NULL
);
CREATE TABLE product_login_transactions (
  id VARCHAR(36) PRIMARY KEY,
  enterprise_id VARCHAR(36) NOT NULL REFERENCES enterprises(enterprise_id),
  application_instance_id VARCHAR(36) NOT NULL REFERENCES application_instances(id),
  principal_id VARCHAR(36) NOT NULL REFERENCES principals(id),
  code_hash CHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ(6) NOT NULL,
  used_at TIMESTAMPTZ(6),
  created_at TIMESTAMPTZ(6) NOT NULL,
  updated_at TIMESTAMPTZ(6) NOT NULL
);
CREATE TABLE sessions (
  id VARCHAR(36) PRIMARY KEY,
  enterprise_id VARCHAR(36) NOT NULL REFERENCES enterprises(enterprise_id),
  principal_id VARCHAR(36) NOT NULL REFERENCES principals(id),
  application_instance_id VARCHAR(36) REFERENCES application_instances(id),
  kind VARCHAR(32) NOT NULL CHECK (kind IN ('admin', 'product')),
  token_hash CHAR(64) NOT NULL UNIQUE,
  csrf_hash CHAR(64) NOT NULL,
  expires_at TIMESTAMPTZ(6) NOT NULL,
  revoked_at TIMESTAMPTZ(6),
  version BIGINT NOT NULL,
  created_at TIMESTAMPTZ(6) NOT NULL,
  updated_at TIMESTAMPTZ(6) NOT NULL
);
CREATE TABLE idempotency_records (
  id VARCHAR(36) PRIMARY KEY,
  enterprise_id VARCHAR(36) NOT NULL REFERENCES enterprises(enterprise_id),
  operation_id VARCHAR(128) NOT NULL,
  idempotency_key VARCHAR(128) NOT NULL,
  method VARCHAR(16) NOT NULL,
  canonical_path VARCHAR(512) NOT NULL,
  request_hash CHAR(64) NOT NULL,
  response_status INTEGER NOT NULL DEFAULT 0,
  response_body_hash CHAR(64) NOT NULL DEFAULT '',
  state VARCHAR(32) NOT NULL,
  expires_at TIMESTAMPTZ(6) NOT NULL,
  created_at TIMESTAMPTZ(6) NOT NULL,
  updated_at TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT uq_idempotency_key UNIQUE (enterprise_id, idempotency_key),
  CONSTRAINT uq_operation_id UNIQUE (enterprise_id, operation_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON login_transactions, product_login_transactions, sessions, idempotency_records TO ecp_runtime;
