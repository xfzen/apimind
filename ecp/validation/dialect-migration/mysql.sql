CREATE TABLE ecp_gate0_records (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  enterprise_id VARCHAR(64) NOT NULL,
  external_id VARCHAR(128) NOT NULL,
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  CONSTRAINT uq_ecp_gate0_enterprise_external UNIQUE (enterprise_id, external_id)
) ENGINE=InnoDB;

CREATE USER IF NOT EXISTS 'ecp_runtime'@'%' IDENTIFIED BY 'ecp-gate0-runtime';
GRANT SELECT, INSERT, UPDATE, DELETE ON ecp_gate0.ecp_gate0_records TO 'ecp_runtime'@'%';
FLUSH PRIVILEGES;
