CREATE TABLE enterprises (
  id VARCHAR(36) PRIMARY KEY,
  enterprise_id VARCHAR(36) NOT NULL UNIQUE,
  singleton_key SMALLINT NOT NULL DEFAULT 1 UNIQUE CHECK (singleton_key = 1),
  name VARCHAR(128) NOT NULL,
  status VARCHAR(32) NOT NULL,
  created_at TIMESTAMPTZ(6) NOT NULL,
  updated_at TIMESTAMPTZ(6) NOT NULL
);

CREATE TABLE applications (
  id VARCHAR(36) PRIMARY KEY,
  enterprise_id VARCHAR(36) NOT NULL REFERENCES enterprises(enterprise_id),
  application_key VARCHAR(64) NOT NULL,
  name VARCHAR(128) NOT NULL,
  status VARCHAR(32) NOT NULL,
  version BIGINT NOT NULL,
  created_at TIMESTAMPTZ(6) NOT NULL,
  updated_at TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT uq_applications_enterprise_key UNIQUE (enterprise_id, application_key)
);

CREATE TABLE application_instances (
  id VARCHAR(36) PRIMARY KEY,
  enterprise_id VARCHAR(36) NOT NULL REFERENCES enterprises(enterprise_id),
  application_id VARCHAR(36) NOT NULL REFERENCES applications(id),
  instance_key VARCHAR(64) NOT NULL,
  environment VARCHAR(32) NOT NULL,
  canonical_url VARCHAR(512) NOT NULL,
  status VARCHAR(32) NOT NULL,
  version BIGINT NOT NULL,
  created_at TIMESTAMPTZ(6) NOT NULL,
  updated_at TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT uq_instances_enterprise_app_key UNIQUE (enterprise_id, application_id, instance_key),
  CONSTRAINT uq_instances_enterprise_url UNIQUE (enterprise_id, canonical_url)
);

CREATE TABLE product_manifests (
  id VARCHAR(36) PRIMARY KEY,
  enterprise_id VARCHAR(36) NOT NULL REFERENCES enterprises(enterprise_id),
  application_id VARCHAR(36) NOT NULL REFERENCES applications(id),
  api_version VARCHAR(64) NOT NULL,
  manifest_hash VARCHAR(64) NOT NULL,
  body TEXT NOT NULL,
  version BIGINT NOT NULL,
  created_at TIMESTAMPTZ(6) NOT NULL,
  updated_at TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT uq_manifests_enterprise_app UNIQUE (enterprise_id, application_id)
);

CREATE TABLE connectors (
  id VARCHAR(36) PRIMARY KEY,
  enterprise_id VARCHAR(36) NOT NULL REFERENCES enterprises(enterprise_id),
  application_id VARCHAR(36) NOT NULL REFERENCES applications(id),
  instance_id VARCHAR(36) NOT NULL REFERENCES application_instances(id),
  connector_key VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL,
  version BIGINT NOT NULL,
  created_at TIMESTAMPTZ(6) NOT NULL,
  updated_at TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT uq_connectors_enterprise_instance_key UNIQUE (enterprise_id, instance_id, connector_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON enterprises, applications, application_instances, product_manifests, connectors TO ecp_runtime;
