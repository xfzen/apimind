-- Passwords are provisioned by scripts/bootstrap-audit-roles.sh and never stored here.
-- The schema owner needs CREATE USER and global GRANT OPTION while running the
-- offline bootstrap. The bootstrap grants ecp_tx_writer each non-audit table
-- individually, so audit_event never inherits read/update/delete privileges.
GRANT INSERT ON ecp_db.audit_event TO 'ecp_tx_writer'@'%';
GRANT INSERT ON ecp_db.audit_event TO 'audit_ingest_writer'@'%';
GRANT SELECT ON ecp_db.audit_event TO 'audit_reader'@'%';
GRANT SELECT ON ecp_db.audit_archive TO 'audit_reader'@'%';
GRANT SELECT, DELETE ON ecp_db.audit_event TO 'audit_maintainer'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE ON ecp_db.audit_archive TO 'audit_maintainer'@'%';
