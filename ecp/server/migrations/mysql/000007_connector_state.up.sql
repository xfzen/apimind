CREATE TABLE connector_channels (
  id VARCHAR(64) PRIMARY KEY, enterprise_id VARCHAR(36) NOT NULL, application_id VARCHAR(36) NOT NULL, instance_id VARCHAR(36) NOT NULL,
  channel VARCHAR(32) NOT NULL, audience VARCHAR(128) NOT NULL, scopes TEXT NOT NULL, secret_digest CHAR(64) NOT NULL,
  rotation_lineage VARCHAR(64) NOT NULL, status VARCHAR(32) NOT NULL, expires_at DATETIME(6) NOT NULL, created_at DATETIME(6) NOT NULL, updated_at DATETIME(6) NOT NULL,
  UNIQUE KEY uq_connector_channel (enterprise_id, instance_id, channel, rotation_lineage),
  CONSTRAINT fk_connector_channels_enterprise FOREIGN KEY (enterprise_id) REFERENCES enterprises(enterprise_id),
  CONSTRAINT fk_connector_channels_application FOREIGN KEY (application_id) REFERENCES applications(id)
) ENGINE=InnoDB;
CREATE TABLE delegation_nonces (
  id VARCHAR(64) PRIMARY KEY, issuer VARCHAR(255) NOT NULL, audience VARCHAR(128) NOT NULL, purpose VARCHAR(64) NOT NULL, nonce VARCHAR(128) NOT NULL,
  expires_at DATETIME(6) NOT NULL, created_at DATETIME(6) NOT NULL, UNIQUE KEY uq_delegation_nonce (issuer, audience, purpose, nonce)
) ENGINE=InnoDB;
CREATE TABLE delegation_keysets (
  id VARCHAR(64) PRIMARY KEY, version BIGINT UNSIGNED NOT NULL, purpose VARCHAR(64) NOT NULL, previous_version BIGINT UNSIGNED NOT NULL,
  previous_fingerprint VARCHAR(64) NOT NULL, keys_json TEXT NOT NULL, payload_hash VARCHAR(64) NOT NULL, signing_kid VARCHAR(128) NOT NULL,
  root_signature TEXT NOT NULL, fingerprint VARCHAR(64) NOT NULL, created_at DATETIME(6) NOT NULL,
  UNIQUE KEY uq_delegation_keyset_version (purpose, version), UNIQUE KEY uq_delegation_keyset_fingerprint (fingerprint)
) ENGINE=InnoDB;
CREATE TABLE delegation_keyset_acks (
  id VARCHAR(64) PRIMARY KEY, connector_id VARCHAR(36) NOT NULL, instance_id VARCHAR(36) NOT NULL, version BIGINT UNSIGNED NOT NULL,
  accepted_key_ids TEXT NOT NULL, acknowledged_at DATETIME(6) NOT NULL, UNIQUE KEY uq_delegation_keyset_ack (connector_id, version),
  CONSTRAINT fk_keyset_ack_connector FOREIGN KEY (connector_id) REFERENCES connectors(id), CONSTRAINT fk_keyset_ack_instance FOREIGN KEY (instance_id) REFERENCES application_instances(id)
) ENGINE=InnoDB;
CREATE TABLE resource_references (
  id VARCHAR(36) PRIMARY KEY, enterprise_id VARCHAR(36) NOT NULL, application_instance_id VARCHAR(36) NOT NULL, resource_type VARCHAR(64) NOT NULL,
  external_id VARCHAR(255) NOT NULL, parent_external_id VARCHAR(255) NOT NULL, display_name VARCHAR(255) NOT NULL, resource_version BIGINT UNSIGNED NOT NULL,
  visible BOOLEAN NOT NULL DEFAULT FALSE, last_seen_at DATETIME(6) NOT NULL, created_at DATETIME(6) NOT NULL, updated_at DATETIME(6) NOT NULL,
  UNIQUE KEY uq_resource_reference (enterprise_id, application_instance_id, resource_type, external_id),
  CONSTRAINT fk_resource_reference_enterprise FOREIGN KEY (enterprise_id) REFERENCES enterprises(enterprise_id), CONSTRAINT fk_resource_reference_instance FOREIGN KEY (application_instance_id) REFERENCES application_instances(id)
) ENGINE=InnoDB;
CREATE TABLE projection_outbox (
  id VARCHAR(36) PRIMARY KEY, enterprise_id VARCHAR(36) NOT NULL, application_instance_id VARCHAR(36) NOT NULL, operation_id VARCHAR(128) NOT NULL,
  projection_type VARCHAR(64) NOT NULL, payload TEXT NOT NULL, state VARCHAR(32) NOT NULL, attempts BIGINT UNSIGNED NOT NULL, last_error TEXT NOT NULL,
  created_at DATETIME(6) NOT NULL, updated_at DATETIME(6) NOT NULL, UNIQUE KEY uq_projection_operation (enterprise_id, operation_id),
  CONSTRAINT fk_projection_enterprise FOREIGN KEY (enterprise_id) REFERENCES enterprises(enterprise_id), CONSTRAINT fk_projection_instance FOREIGN KEY (application_instance_id) REFERENCES application_instances(id)
) ENGINE=InnoDB;
