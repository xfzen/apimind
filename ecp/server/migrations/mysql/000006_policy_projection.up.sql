CREATE TABLE policy_projections (
  id VARCHAR(36) PRIMARY KEY,
  enterprise_id VARCHAR(36) NOT NULL,
  application_instance_id VARCHAR(36) NOT NULL,
  casdoor_policy_ids LONGTEXT NOT NULL,
  normalized_hash CHAR(64) NOT NULL,
  manifest_version BIGINT UNSIGNED NOT NULL,
  policy_version BIGINT UNSIGNED NOT NULL,
  reconciliation_state VARCHAR(32) NOT NULL,
  last_error LONGTEXT NOT NULL,
  created_at TIMESTAMP(6) NOT NULL,
  updated_at TIMESTAMP(6) NOT NULL,
  CONSTRAINT fk_policy_projection_enterprise FOREIGN KEY (enterprise_id) REFERENCES enterprises(enterprise_id),
  CONSTRAINT fk_policy_projection_instance FOREIGN KEY (application_instance_id) REFERENCES application_instances(id),
  CONSTRAINT uq_policy_projection_instance UNIQUE (enterprise_id, application_instance_id)
) ENGINE=InnoDB;
CREATE TABLE security_configs (
  id VARCHAR(36) PRIMARY KEY,
  enterprise_id VARCHAR(36) NOT NULL,
  application_instance_id VARCHAR(36) NOT NULL,
  public_sharing BOOLEAN NOT NULL DEFAULT FALSE,
  export_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  secret_export BOOLEAN NOT NULL DEFAULT FALSE,
  version BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP(6) NOT NULL,
  updated_at TIMESTAMP(6) NOT NULL,
  CONSTRAINT fk_security_config_enterprise FOREIGN KEY (enterprise_id) REFERENCES enterprises(enterprise_id),
  CONSTRAINT fk_security_config_instance FOREIGN KEY (application_instance_id) REFERENCES application_instances(id),
  CONSTRAINT uq_security_config_instance UNIQUE (enterprise_id, application_instance_id)
) ENGINE=InnoDB;
