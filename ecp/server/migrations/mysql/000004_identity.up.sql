CREATE TABLE principals (
  id VARCHAR(36) PRIMARY KEY,
  enterprise_id VARCHAR(36) NOT NULL,
  origin_application_id VARCHAR(36) NOT NULL,
  issuer VARCHAR(512) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  normalized_email VARCHAR(320) NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  status VARCHAR(32) NOT NULL,
  version BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP(6) NOT NULL,
  updated_at TIMESTAMP(6) NOT NULL,
  CONSTRAINT fk_principals_enterprise FOREIGN KEY (enterprise_id) REFERENCES enterprises(enterprise_id),
  CONSTRAINT fk_principals_application FOREIGN KEY (origin_application_id) REFERENCES applications(id),
  CONSTRAINT uq_principals_external UNIQUE (enterprise_id, issuer(191), subject(191)),
  CONSTRAINT uq_principals_verified_email UNIQUE (enterprise_id, normalized_email)
) ENGINE=InnoDB;

CREATE TABLE identity_groups (
  id VARCHAR(36) PRIMARY KEY,
  enterprise_id VARCHAR(36) NOT NULL,
  provider VARCHAR(128) NOT NULL,
  external_id VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  management_mode VARCHAR(32) NOT NULL,
  direct_member_version BIGINT UNSIGNED NOT NULL,
  status VARCHAR(32) NOT NULL,
  created_at TIMESTAMP(6) NOT NULL,
  updated_at TIMESTAMP(6) NOT NULL,
  CONSTRAINT fk_identity_groups_enterprise FOREIGN KEY (enterprise_id) REFERENCES enterprises(enterprise_id),
  CONSTRAINT uq_identity_groups_external UNIQUE (enterprise_id, provider, external_id)
) ENGINE=InnoDB;

CREATE TABLE direct_group_memberships (
  enterprise_id VARCHAR(36) NOT NULL,
  group_id VARCHAR(36) NOT NULL,
  principal_id VARCHAR(36) NOT NULL,
  created_at TIMESTAMP(6) NOT NULL,
  PRIMARY KEY (enterprise_id, group_id, principal_id),
  CONSTRAINT fk_memberships_enterprise FOREIGN KEY (enterprise_id) REFERENCES enterprises(enterprise_id),
  CONSTRAINT fk_memberships_group FOREIGN KEY (group_id) REFERENCES identity_groups(id) ON DELETE CASCADE,
  CONSTRAINT fk_memberships_principal FOREIGN KEY (principal_id) REFERENCES principals(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE principal_lifecycle (
  id VARCHAR(36) PRIMARY KEY,
  enterprise_id VARCHAR(36) NOT NULL,
  principal_id VARCHAR(36) NOT NULL,
  state VARCHAR(32) NOT NULL,
  version BIGINT UNSIGNED NOT NULL,
  blocked_at TIMESTAMP(6) NULL,
  created_at TIMESTAMP(6) NOT NULL,
  updated_at TIMESTAMP(6) NOT NULL,
  CONSTRAINT fk_lifecycle_enterprise FOREIGN KEY (enterprise_id) REFERENCES enterprises(enterprise_id),
  CONSTRAINT fk_lifecycle_principal FOREIGN KEY (principal_id) REFERENCES principals(id) ON DELETE CASCADE,
  CONSTRAINT uq_principal_lifecycle UNIQUE (enterprise_id, principal_id)
) ENGINE=InnoDB;

CREATE TABLE identity_sync_states (
  id VARCHAR(36) PRIMARY KEY,
  enterprise_id VARCHAR(36) NOT NULL,
  provider VARCHAR(128) NOT NULL,
  version BIGINT UNSIGNED NOT NULL,
  last_successful_sync TIMESTAMP(6) NULL,
  freshness_deadline TIMESTAMP(6) NULL,
  source_cursor VARCHAR(512) NOT NULL,
  state VARCHAR(32) NOT NULL,
  last_error LONGTEXT NOT NULL,
  created_at TIMESTAMP(6) NOT NULL,
  updated_at TIMESTAMP(6) NOT NULL,
  CONSTRAINT fk_sync_states_enterprise FOREIGN KEY (enterprise_id) REFERENCES enterprises(enterprise_id),
  CONSTRAINT uq_identity_sync_states UNIQUE (enterprise_id, provider)
) ENGINE=InnoDB;

CREATE TABLE identity_invitations (
  id VARCHAR(36) PRIMARY KEY,
  enterprise_id VARCHAR(36) NOT NULL,
  application_id VARCHAR(36) NOT NULL,
  normalized_verified_email VARCHAR(320) NOT NULL,
  expires_at TIMESTAMP(6) NOT NULL,
  used_at TIMESTAMP(6) NULL,
  state VARCHAR(32) NOT NULL,
  created_at TIMESTAMP(6) NOT NULL,
  updated_at TIMESTAMP(6) NOT NULL,
  CONSTRAINT fk_invitations_enterprise FOREIGN KEY (enterprise_id) REFERENCES enterprises(enterprise_id),
  CONSTRAINT fk_invitations_application FOREIGN KEY (application_id) REFERENCES applications(id)
) ENGINE=InnoDB;

CREATE TABLE legacy_identity_mappings (
  id VARCHAR(36) PRIMARY KEY,
  enterprise_id VARCHAR(36) NOT NULL,
  application_id VARCHAR(36) NOT NULL,
  legacy_source VARCHAR(64) NOT NULL,
  legacy_subject VARCHAR(255) NOT NULL,
  principal_id VARCHAR(36) NOT NULL,
  created_at TIMESTAMP(6) NOT NULL,
  CONSTRAINT fk_legacy_mapping_enterprise FOREIGN KEY (enterprise_id) REFERENCES enterprises(enterprise_id),
  CONSTRAINT fk_legacy_mapping_application FOREIGN KEY (application_id) REFERENCES applications(id),
  CONSTRAINT fk_legacy_mapping_principal FOREIGN KEY (principal_id) REFERENCES principals(id),
  CONSTRAINT uq_legacy_identity UNIQUE (enterprise_id, application_id, legacy_source, legacy_subject)
) ENGINE=InnoDB;
