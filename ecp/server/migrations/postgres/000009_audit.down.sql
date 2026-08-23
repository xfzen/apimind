DROP TRIGGER IF EXISTS audit_event_append_only ON audit_event;
DROP FUNCTION IF EXISTS prevent_online_audit_mutation();
DROP TABLE IF EXISTS audit_archive;
DROP TABLE IF EXISTS audit_event;
