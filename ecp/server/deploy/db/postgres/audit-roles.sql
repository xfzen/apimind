-- Passwords are provisioned by scripts/bootstrap-audit-roles.sh and never stored here.
GRANT USAGE ON SCHEMA public TO ecp_tx_writer, audit_ingest_writer, audit_reader, audit_maintainer;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ecp_tx_writer;
REVOKE SELECT, UPDATE, DELETE, TRUNCATE ON audit_event FROM ecp_tx_writer;
GRANT INSERT ON audit_event TO ecp_tx_writer, audit_ingest_writer;
GRANT USAGE, SELECT ON SEQUENCE audit_event_sequence_seq TO ecp_tx_writer, audit_ingest_writer;
GRANT SELECT ON audit_event, audit_archive TO audit_reader;
GRANT SELECT, DELETE ON audit_event TO audit_maintainer;
GRANT SELECT, INSERT, UPDATE, DELETE ON audit_archive TO audit_maintainer;
