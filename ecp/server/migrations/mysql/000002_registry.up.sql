CREATE TABLE enterprises (
  id VARCHAR(36) PRIMARY KEY,
  enterprise_id VARCHAR(36) NOT NULL UNIQUE,
  singleton_key SMALLINT NOT NULL DEFAULT 1 UNIQUE CHECK (singleton_key = 1),
  name VARCHAR(128) NOT NULL,
  status VARCHAR(32) NOT NULL,
  created_at TIMESTAMP(6) NOT NULL,
  updated_at TIMESTAMP(6) NOT NULL
) ENGINE=InnoDB;

CREATE TABLE applications (
  id VARCHAR(36) PRIMARY KEY,
  enterprise_id VARCHAR(36) NOT NULL,
  application_key VARCHAR(64) NOT NULL,
  name VARCHAR(128) NOT NULL,
  status VARCHAR(32) NOT NULL,
  version BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP(6) NOT NULL,
  updated_at TIMESTAMP(6) NOT NULL,
  CONSTRAINT fk_applications_enterprise FOREIGN KEY (enterprise_id) REFERENCES enterprises(enterprise_id),
  CONSTRAINT uq_applications_enterprise_key UNIQUE (enterprise_id, application_key)
) ENGINE=InnoDB;

CREATE TABLE application_instances (
  id VARCHAR(36) PRIMARY KEY,
  enterprise_id VARCHAR(36) NOT NULL,
  application_id VARCHAR(36) NOT NULL,
  instance_key VARCHAR(64) NOT NULL,
  environment VARCHAR(32) NOT NULL,
  canonical_url VARCHAR(512) NOT NULL,
  status VARCHAR(32) NOT NULL,
  version BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP(6) NOT NULL,
  updated_at TIMESTAMP(6) NOT NULL,
  CONSTRAINT fk_instances_enterprise FOREIGN KEY (enterprise_id) REFERENCES enterprises(enterprise_id),
  CONSTRAINT fk_instances_application FOREIGN KEY (application_id) REFERENCES applications(id),
  CONSTRAINT uq_instances_enterprise_app_key UNIQUE (enterprise_id, application_id, instance_key),
  CONSTRAINT uq_instances_enterprise_url UNIQUE (enterprise_id, canonical_url)
) ENGINE=InnoDB;

CREATE TABLE product_manifests (
  id VARCHAR(36) PRIMARY KEY,
  enterprise_id VARCHAR(36) NOT NULL,
  application_id VARCHAR(36) NOT NULL,
  api_version VARCHAR(64) NOT NULL,
  manifest_hash VARCHAR(64) NOT NULL,
  body LONGTEXT NOT NULL,
  version BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP(6) NOT NULL,
  updated_at TIMESTAMP(6) NOT NULL,
  CONSTRAINT fk_manifests_enterprise FOREIGN KEY (enterprise_id) REFERENCES enterprises(enterprise_id),
  CONSTRAINT fk_manifests_application FOREIGN KEY (application_id) REFERENCES applications(id),
  CONSTRAINT uq_manifests_enterprise_app UNIQUE (enterprise_id, application_id)
) ENGINE=InnoDB;

CREATE TABLE connectors (
  id VARCHAR(36) PRIMARY KEY,
  enterprise_id VARCHAR(36) NOT NULL,
  application_id VARCHAR(36) NOT NULL,
  instance_id VARCHAR(36) NOT NULL,
  connector_key VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL,
  version BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP(6) NOT NULL,
  updated_at TIMESTAMP(6) NOT NULL,
  CONSTRAINT fk_connectors_enterprise FOREIGN KEY (enterprise_id) REFERENCES enterprises(enterprise_id),
  CONSTRAINT fk_connectors_application FOREIGN KEY (application_id) REFERENCES applications(id),
  CONSTRAINT fk_connectors_instance FOREIGN KEY (instance_id) REFERENCES application_instances(id),
  CONSTRAINT uq_connectors_enterprise_instance_key UNIQUE (enterprise_id, instance_id, connector_key)
) ENGINE=InnoDB;
