package main

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"strings"

	_ "github.com/go-sql-driver/mysql"
	_ "github.com/jackc/pgx/v5/stdlib"
)

func main() {
	if len(os.Args) != 2 || os.Args[1] != "bootstrap" {
		fail("usage: audit-bootstrap bootstrap")
	}
	driver := os.Getenv("ECP_DB_DRIVER")
	dsn := os.Getenv("ECP_MIGRATION_DSN")
	if dsn == "" {
		fail("ECP_MIGRATION_DSN is required")
	}
	passwords := map[string]string{"ecp_schema_owner": os.Getenv("ECP_SCHEMA_OWNER_PASSWORD"), "ecp_tx_writer": os.Getenv("ECP_TX_WRITER_PASSWORD"), "audit_ingest_writer": os.Getenv("ECP_AUDIT_INGEST_PASSWORD"), "audit_reader": os.Getenv("ECP_AUDIT_READER_PASSWORD"), "audit_maintainer": os.Getenv("ECP_AUDIT_MAINTAINER_PASSWORD")}
	for role, password := range passwords {
		if password == "" {
			fail(role + " password is required")
		}
	}
	sqlDriver := driver
	if driver == "postgres" {
		sqlDriver = "pgx"
	}
	db, err := sql.Open(sqlDriver, dsn)
	if err != nil {
		fail(err.Error())
	}
	defer db.Close()
	ctx := context.Background()
	if err := db.PingContext(ctx); err != nil {
		fail(err.Error())
	}
	if driver == "postgres" {
		err = bootstrapPostgres(ctx, db, passwords)
	} else if driver == "mysql" {
		err = bootstrapMySQL(ctx, db, passwords)
	} else {
		err = fmt.Errorf("unsupported driver")
	}
	if err != nil {
		fail(err.Error())
	}
}

func bootstrapPostgres(ctx context.Context, db *sql.DB, passwords map[string]string) error {
	for _, role := range []string{"ecp_schema_owner", "ecp_tx_writer", "audit_ingest_writer", "audit_reader", "audit_maintainer"} {
		var exists bool
		if err := db.QueryRowContext(ctx, "SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname=$1)", role).Scan(&exists); err != nil {
			return err
		}
		var statement string
		query := "SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', $1::text, $2::text)"
		if exists {
			query = "SELECT format('ALTER ROLE %I LOGIN PASSWORD %L', $1::text, $2::text)"
		}
		if err := db.QueryRowContext(ctx, query, role, passwords[role]).Scan(&statement); err != nil {
			return err
		}
		if _, err := db.ExecContext(ctx, statement); err != nil {
			return err
		}
	}
	statements := []string{"GRANT USAGE ON SCHEMA public TO ecp_tx_writer, audit_ingest_writer, audit_reader, audit_maintainer", "GRANT CREATE, USAGE ON SCHEMA public TO ecp_schema_owner", "GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ecp_tx_writer", "REVOKE ALL ON audit_event, audit_archive FROM ecp_tx_writer, audit_ingest_writer, audit_reader, audit_maintainer", "GRANT INSERT ON audit_event TO ecp_tx_writer, audit_ingest_writer", "GRANT USAGE, SELECT ON SEQUENCE audit_event_sequence_seq TO ecp_tx_writer, audit_ingest_writer", "GRANT SELECT ON audit_event, audit_archive TO audit_reader", "GRANT SELECT, DELETE ON audit_event TO audit_maintainer", "GRANT SELECT, INSERT, UPDATE, DELETE ON audit_archive TO audit_maintainer"}
	for _, statement := range statements {
		if _, err := db.ExecContext(ctx, statement); err != nil {
			return err
		}
	}
	return nil
}

func bootstrapMySQL(ctx context.Context, db *sql.DB, passwords map[string]string) error {
	var database string
	if err := db.QueryRowContext(ctx, "SELECT DATABASE()").Scan(&database); err != nil {
		return err
	}
	quotedDB := "`" + strings.ReplaceAll(database, "`", "``") + "`"
	for _, role := range []string{"ecp_schema_owner", "ecp_tx_writer", "audit_ingest_writer", "audit_reader", "audit_maintainer"} {
		account := "'" + role + "'@'%'"
		password := strings.ReplaceAll(strings.ReplaceAll(passwords[role], "\\", "\\\\"), "'", "''")
		if _, err := db.ExecContext(ctx, "CREATE USER IF NOT EXISTS "+account+" IDENTIFIED BY '"+password+"'"); err != nil {
			return err
		}
		if _, err := db.ExecContext(ctx, "ALTER USER "+account+" IDENTIFIED BY '"+password+"'"); err != nil {
			return err
		}
		if _, err := db.ExecContext(ctx, "REVOKE ALL PRIVILEGES, GRANT OPTION FROM "+account); err != nil {
			return err
		}
	}
	statements := []string{"GRANT ALL PRIVILEGES ON " + quotedDB + ".* TO 'ecp_schema_owner'@'%'", "GRANT INSERT ON " + quotedDB + ".audit_event TO 'ecp_tx_writer'@'%'", "GRANT INSERT ON " + quotedDB + ".audit_event TO 'audit_ingest_writer'@'%'", "GRANT SELECT ON " + quotedDB + ".audit_event TO 'audit_reader'@'%'", "GRANT SELECT ON " + quotedDB + ".audit_archive TO 'audit_reader'@'%'", "GRANT SELECT, DELETE ON " + quotedDB + ".audit_event TO 'audit_maintainer'@'%'", "GRANT SELECT, INSERT, UPDATE, DELETE ON " + quotedDB + ".audit_archive TO 'audit_maintainer'@'%'"}
	for _, statement := range statements {
		if _, err := db.ExecContext(ctx, statement); err != nil {
			return err
		}
	}
	rows, err := db.QueryContext(ctx, "SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name NOT IN ('audit_event','audit_archive')")
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var table string
		if err := rows.Scan(&table); err != nil {
			return err
		}
		quotedTable := "`" + strings.ReplaceAll(table, "`", "``") + "`"
		if _, err := db.ExecContext(ctx, "GRANT SELECT, INSERT, UPDATE, DELETE ON "+quotedDB+"."+quotedTable+" TO 'ecp_tx_writer'@'%'"); err != nil {
			return err
		}
	}
	if err := rows.Err(); err != nil {
		return err
	}
	return nil
}
func fail(message string) { _, _ = fmt.Fprintln(os.Stderr, message); os.Exit(1) }
