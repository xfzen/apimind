CREATE TABLE policy_projections (
  id VARCHAR(36) PRIMARY KEY,
  enterprise_id VARCHAR(36) NOT NULL REFERENCES enterprises(enterprise_id),
  application_instance_id VARCHAR(36) NOT NULL REFERENCES application_instances(id),
  casdoor_policy_ids TEXT NOT NULL,
  normalized_hash CHAR(64) NOT NULL,
  manifest_version BIGINT NOT NULL,
  policy_version BIGINT NOT NULL,
  reconciliation_state VARCHAR(32) NOT NULL CHECK (reconciliation_state IN ('in_sync','drifted')),
  last_error TEXT NOT NULL,
  created_at TIMESTAMPTZ(6) NOT NULL,
  updated_at TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT uq_policy_projection_instance UNIQUE (enterprise_id, application_instance_id)
);
CREATE TABLE security_configs (
  id VARCHAR(36) PRIMARY KEY,
  enterprise_id VARCHAR(36) NOT NULL REFERENCES enterprises(enterprise_id),
  application_instance_id VARCHAR(36) NOT NULL REFERENCES application_instances(id),
  public_sharing BOOLEAN NOT NULL DEFAULT FALSE,
  export_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  secret_export BOOLEAN NOT NULL DEFAULT FALSE,
  version BIGINT NOT NULL,
  created_at TIMESTAMPTZ(6) NOT NULL,
  updated_at TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT uq_security_config_instance UNIQUE (enterprise_id, application_instance_id)
);
