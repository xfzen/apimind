CREATE TABLE principals (
  id VARCHAR(36) PRIMARY KEY,
  enterprise_id VARCHAR(36) NOT NULL REFERENCES enterprises(enterprise_id),
  origin_application_id VARCHAR(36) NOT NULL REFERENCES applications(id),
  issuer VARCHAR(512) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  normalized_email VARCHAR(320) NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  status VARCHAR(32) NOT NULL,
  version BIGINT NOT NULL,
  created_at TIMESTAMPTZ(6) NOT NULL,
  updated_at TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT uq_principals_external UNIQUE (enterprise_id, issuer, subject),
  CONSTRAINT uq_principals_verified_email UNIQUE (enterprise_id, normalized_email)
);

CREATE TABLE identity_groups (
  id VARCHAR(36) PRIMARY KEY,
  enterprise_id VARCHAR(36) NOT NULL REFERENCES enterprises(enterprise_id),
  provider VARCHAR(128) NOT NULL,
  external_id VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  management_mode VARCHAR(32) NOT NULL CHECK (management_mode IN ('ecp_managed', 'directory_managed')),
  direct_member_version BIGINT NOT NULL,
  status VARCHAR(32) NOT NULL,
  created_at TIMESTAMPTZ(6) NOT NULL,
  updated_at TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT uq_identity_groups_external UNIQUE (enterprise_id, provider, external_id)
);

CREATE TABLE direct_group_memberships (
  enterprise_id VARCHAR(36) NOT NULL REFERENCES enterprises(enterprise_id),
  group_id VARCHAR(36) NOT NULL REFERENCES identity_groups(id) ON DELETE CASCADE,
  principal_id VARCHAR(36) NOT NULL REFERENCES principals(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ(6) NOT NULL,
  PRIMARY KEY (enterprise_id, group_id, principal_id)
);

CREATE TABLE principal_lifecycle (
  id VARCHAR(36) PRIMARY KEY,
  enterprise_id VARCHAR(36) NOT NULL REFERENCES enterprises(enterprise_id),
  principal_id VARCHAR(36) NOT NULL REFERENCES principals(id) ON DELETE CASCADE,
  state VARCHAR(32) NOT NULL CHECK (state IN ('active', 'blocked', 'pending_external_sync')),
  version BIGINT NOT NULL,
  blocked_at TIMESTAMPTZ(6),
  created_at TIMESTAMPTZ(6) NOT NULL,
  updated_at TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT uq_principal_lifecycle UNIQUE (enterprise_id, principal_id)
);

CREATE TABLE identity_sync_states (
  id VARCHAR(36) PRIMARY KEY,
  enterprise_id VARCHAR(36) NOT NULL REFERENCES enterprises(enterprise_id),
  provider VARCHAR(128) NOT NULL,
  version BIGINT NOT NULL,
  last_successful_sync TIMESTAMPTZ(6),
  freshness_deadline TIMESTAMPTZ(6),
  source_cursor VARCHAR(512) NOT NULL,
  state VARCHAR(32) NOT NULL CHECK (state IN ('fresh', 'stale')),
  last_error TEXT NOT NULL,
  created_at TIMESTAMPTZ(6) NOT NULL,
  updated_at TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT uq_identity_sync_states UNIQUE (enterprise_id, provider)
);

CREATE TABLE identity_invitations (
  id VARCHAR(36) PRIMARY KEY,
  enterprise_id VARCHAR(36) NOT NULL REFERENCES enterprises(enterprise_id),
  application_id VARCHAR(36) NOT NULL REFERENCES applications(id),
  normalized_verified_email VARCHAR(320) NOT NULL,
  expires_at TIMESTAMPTZ(6) NOT NULL,
  used_at TIMESTAMPTZ(6),
  state VARCHAR(32) NOT NULL,
  created_at TIMESTAMPTZ(6) NOT NULL,
  updated_at TIMESTAMPTZ(6) NOT NULL
);

CREATE TABLE legacy_identity_mappings (
  id VARCHAR(36) PRIMARY KEY,
  enterprise_id VARCHAR(36) NOT NULL REFERENCES enterprises(enterprise_id),
  application_id VARCHAR(36) NOT NULL REFERENCES applications(id),
  legacy_source VARCHAR(64) NOT NULL,
  legacy_subject VARCHAR(255) NOT NULL,
  principal_id VARCHAR(36) NOT NULL REFERENCES principals(id),
  created_at TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT uq_legacy_identity UNIQUE (enterprise_id, application_id, legacy_source, legacy_subject)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON principals, identity_groups, direct_group_memberships, principal_lifecycle, identity_sync_states, identity_invitations, legacy_identity_mappings TO ecp_runtime;
