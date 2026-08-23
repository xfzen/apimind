CREATE TABLE ecp_migration_probe (
  id VARCHAR(36) PRIMARY KEY,
  enterprise_id VARCHAR(36) NOT NULL,
  external_id VARCHAR(128) NOT NULL,
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  CONSTRAINT uq_ecp_migration_probe_enterprise_external UNIQUE (enterprise_id, external_id)
) ENGINE=InnoDB;
