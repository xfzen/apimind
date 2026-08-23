CREATE TABLE connector_channels (
  id VARCHAR(64) PRIMARY KEY,
  enterprise_id VARCHAR(36) NOT NULL REFERENCES enterprises(enterprise_id),
  application_id VARCHAR(36) NOT NULL REFERENCES applications(id),
  instance_id VARCHAR(36) NOT NULL,
  channel VARCHAR(32) NOT NULL CHECK (channel IN ('product_to_ecp','ecp_to_product','keyset_operator')),
  audience VARCHAR(128) NOT NULL,
  scopes TEXT NOT NULL,
  secret_digest CHAR(64) NOT NULL,
  rotation_lineage VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL,
  expires_at TIMESTAMPTZ(6) NOT NULL,
  created_at TIMESTAMPTZ(6) NOT NULL,
  updated_at TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT uq_connector_channel UNIQUE (enterprise_id, instance_id, channel, rotation_lineage)
);
CREATE TABLE delegation_nonces (
  id VARCHAR(64) PRIMARY KEY,
  issuer VARCHAR(255) NOT NULL,
  audience VARCHAR(128) NOT NULL,
  purpose VARCHAR(64) NOT NULL,
  nonce VARCHAR(128) NOT NULL,
  expires_at TIMESTAMPTZ(6) NOT NULL,
  created_at TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT uq_delegation_nonce UNIQUE (issuer, audience, purpose, nonce)
);
CREATE TABLE delegation_keysets (
  id VARCHAR(64) PRIMARY KEY,
  version BIGINT NOT NULL,
  purpose VARCHAR(64) NOT NULL,
  previous_version BIGINT NOT NULL,
  previous_fingerprint VARCHAR(64) NOT NULL,
  keys_json TEXT NOT NULL,
  payload_hash VARCHAR(64) NOT NULL,
  signing_kid VARCHAR(128) NOT NULL,
  root_signature TEXT NOT NULL,
  fingerprint VARCHAR(64) NOT NULL,
  created_at TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT uq_delegation_keyset_version UNIQUE (purpose, version),
  CONSTRAINT uq_delegation_keyset_fingerprint UNIQUE (fingerprint)
);
CREATE TABLE delegation_keyset_acks (
  id VARCHAR(64) PRIMARY KEY,
  connector_id VARCHAR(36) NOT NULL REFERENCES connectors(id),
  instance_id VARCHAR(36) NOT NULL REFERENCES application_instances(id),
  version BIGINT NOT NULL,
  accepted_key_ids TEXT NOT NULL,
  acknowledged_at TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT uq_delegation_keyset_ack UNIQUE (connector_id, version)
);
CREATE TABLE resource_references (
  id VARCHAR(36) PRIMARY KEY,
  enterprise_id VARCHAR(36) NOT NULL REFERENCES enterprises(enterprise_id),
  application_instance_id VARCHAR(36) NOT NULL REFERENCES application_instances(id),
  resource_type VARCHAR(64) NOT NULL,
  external_id VARCHAR(255) NOT NULL,
  parent_external_id VARCHAR(255) NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  resource_version BIGINT NOT NULL,
  visible BOOLEAN NOT NULL DEFAULT FALSE,
  last_seen_at TIMESTAMPTZ(6) NOT NULL,
  created_at TIMESTAMPTZ(6) NOT NULL,
  updated_at TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT uq_resource_reference UNIQUE (enterprise_id, application_instance_id, resource_type, external_id)
);
CREATE TABLE projection_outbox (
  id VARCHAR(36) PRIMARY KEY,
  enterprise_id VARCHAR(36) NOT NULL REFERENCES enterprises(enterprise_id),
  application_instance_id VARCHAR(36) NOT NULL REFERENCES application_instances(id),
  operation_id VARCHAR(128) NOT NULL,
  projection_type VARCHAR(64) NOT NULL,
  payload TEXT NOT NULL,
  state VARCHAR(32) NOT NULL,
  attempts BIGINT NOT NULL,
  last_error TEXT NOT NULL,
  created_at TIMESTAMPTZ(6) NOT NULL,
  updated_at TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT uq_projection_operation UNIQUE (enterprise_id, operation_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON connector_channels, delegation_nonces, delegation_keysets, delegation_keyset_acks, resource_references, projection_outbox TO ecp_runtime;
