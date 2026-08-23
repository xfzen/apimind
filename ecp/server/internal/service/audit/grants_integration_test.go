package audit_test

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"strings"
	"testing"
	"time"

	_ "github.com/go-sql-driver/mysql"
	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/xfzen/ecp/server/config"
	persistence "github.com/xfzen/ecp/server/internal/infra/persistence/gorm"
	auditservice "github.com/xfzen/ecp/server/internal/service/audit"
	"gorm.io/gorm"
)

func TestAuditRoleGrants(t *testing.T) {
	for _, test := range []struct{ name, driver, prefix string }{{"postgres", "pgx", "ECP_TEST_POSTGRES"}, {"mysql", "mysql", "ECP_TEST_MYSQL"}} {
		t.Run(test.name, func(t *testing.T) {
			migrationDSN := os.Getenv(test.prefix + "_MIGRATION_DSN")
			if migrationDSN == "" {
				t.Skip("audit role DSNs are not configured")
			}
			business := open(t, test.driver, os.Getenv(test.prefix+"_BUSINESS_DSN"))
			ingest := open(t, test.driver, os.Getenv(test.prefix+"_AUDIT_INGEST_DSN"))
			reader := open(t, test.driver, os.Getenv(test.prefix+"_AUDIT_READ_DSN"))
			maintainer := open(t, test.driver, os.Getenv(test.prefix+"_AUDIT_MAINTAINER_DSN"))
			migration := open(t, test.driver, migrationDSN)
			seedAuditFixture(t, migration, test.name)
			id := "audit-grant-" + test.name
			insertAudit(t, business, id+"-business")
			insertAudit(t, ingest, id+"-ingest")
			mustFail(t, business, "UPDATE audit_event SET reason='x' WHERE id=?", id+"-business")
			mustFail(t, business, "DELETE FROM audit_event WHERE id=?", id+"-business")
			mustFail(t, ingest, "SELECT sequence FROM audit_event WHERE id=?", id+"-ingest")
			mustFail(t, ingest, "UPDATE audit_event SET reason='x' WHERE id=?", id+"-ingest")
			mustSucceed(t, reader, "SELECT sequence FROM audit_event WHERE id=?", id+"-business")
			mustFail(t, reader, auditInsertSQL(test.name), auditArgs(id+"-reader")...)
			mustFail(t, reader, "DELETE FROM audit_event WHERE id=?", id+"-business")
			mustSucceed(t, maintainer, "SELECT sequence FROM audit_event WHERE id=?", id+"-business")
			mustSucceed(t, maintainer, "DELETE FROM audit_event WHERE id IN (?,?)", id+"-business", id+"-ingest")
			assertNoTruncate(t, migration, test.name)
			for _, db := range []*sql.DB{business, ingest, reader, maintainer, migration} {
				_ = db.Close()
			}
		})
	}
}

func TestBusinessMutationAndCommittedAuditRollbackTogether(t *testing.T) {
	for _, test := range []struct{ name, driver, migrationEnv, businessEnv, ingestEnv, readEnv string }{{"postgres", "postgres", "ECP_TEST_POSTGRES_MIGRATION_DSN", "ECP_TEST_POSTGRES_BUSINESS_DSN", "ECP_TEST_POSTGRES_AUDIT_INGEST_DSN", "ECP_TEST_POSTGRES_AUDIT_READ_DSN"}, {"mysql", "mysql", "ECP_TEST_MYSQL_MIGRATION_DSN", "ECP_TEST_MYSQL_BUSINESS_DSN", "ECP_TEST_MYSQL_AUDIT_INGEST_DSN", "ECP_TEST_MYSQL_AUDIT_READ_DSN"}} {
		t.Run(test.name, func(t *testing.T) {
			if os.Getenv(test.migrationEnv) == "" {
				t.Skip("audit DSNs are not configured")
			}
			migration := open(t, map[string]string{"postgres": "pgx", "mysql": "mysql"}[test.driver], os.Getenv(test.migrationEnv))
			seedAuditFixture(t, migration, test.name)
			business, err := persistence.Open(config.DatabaseConfig{Driver: test.driver, DSN: os.Getenv(test.businessEnv)})
			if err != nil {
				t.Fatal(err)
			}
			ingest, err := persistence.Open(config.DatabaseConfig{Driver: test.driver, DSN: os.Getenv(test.ingestEnv)})
			if err != nil {
				t.Fatal(err)
			}
			read, err := persistence.Open(config.DatabaseConfig{Driver: test.driver, DSN: os.Getenv(test.readEnv)})
			if err != nil {
				t.Fatal(err)
			}
			service := auditservice.New(persistence.NewAuditTransactionStore(business), persistence.NewAuditAppendStore(ingest), persistence.NewAuditReadStore(read), nil)
			injected := fmt.Errorf("injected rollback")
			operation := auditservice.Operation{ID: "rollback-" + test.name, EnterpriseID: "ent-audit-" + test.name, ApplicationInstanceID: "ins-audit-" + test.name, ActorID: "principal", ActorKind: "human", Action: "projection.write", ResourceType: "instance", ResourceID: "ins-audit-" + test.name}
			err = service.CommitWithMutation(context.Background(), operation, func(tx *gorm.DB) error {
				now := time.Now().UTC()
				if err := tx.Exec("INSERT INTO projection_outbox (id,enterprise_id,application_instance_id,operation_id,projection_type,payload,state,attempts,last_error,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)", "outbox-"+test.name, operation.EnterpriseID, operation.ApplicationInstanceID, operation.ID, "test", `{}`, "pending", 0, "", now, now).Error; err != nil {
					return err
				}
				return injected
			})
			if err == nil || !strings.Contains(err.Error(), "injected rollback") {
				t.Fatalf("error=%v", err)
			}
			var count int64
			if err := business.Table("projection_outbox").Where("operation_id = ?", operation.ID).Count(&count).Error; err != nil || count != 0 {
				t.Fatalf("mutation count=%d err=%v", count, err)
			}
			events, err := service.Query(context.Background(), auditservice.Query{EnterpriseID: operation.EnterpriseID, OperationID: operation.ID, Limit: 10})
			if err != nil || len(events) != 0 {
				t.Fatalf("events=%d err=%v", len(events), err)
			}
		})
	}
}

func open(t *testing.T, driver, dsn string) *sql.DB {
	t.Helper()
	if dsn == "" {
		t.Fatal("role DSN is missing")
	}
	db, err := sql.Open(driver, dsn)
	if err != nil {
		t.Fatal(err)
	}
	if err := db.Ping(); err != nil {
		t.Fatal(err)
	}
	return db
}
func seedAuditFixture(t *testing.T, db *sql.DB, dialect string) {
	t.Helper()
	suffix := dialect
	now := time.Now().UTC()
	statements := []struct {
		query string
		args  []any
	}{{"INSERT INTO enterprises (id,enterprise_id,singleton_key,name,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?)", []any{"ent-audit-" + suffix, "ent-audit-" + suffix, 1, "Audit", "active", now, now}}, {"INSERT INTO applications (id,enterprise_id,application_key,name,status,version,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)", []any{"app-audit-" + suffix, "ent-audit-" + suffix, "audit", "Audit", "active", 1, now, now}}, {"INSERT INTO application_instances (id,enterprise_id,application_id,instance_key,environment,canonical_url,status,version,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)", []any{"ins-audit-" + suffix, "ent-audit-" + suffix, "app-audit-" + suffix, "prod", "production", "https://audit.example.com/" + suffix, "active", 1, now, now}}}
	for _, statement := range statements {
		query := statement.query
		if dialect == "postgres" {
			query = postgresPlaceholders(query)
		}
		if _, err := db.Exec(query, statement.args...); err != nil && !strings.Contains(strings.ToLower(err.Error()), "duplicate") {
			t.Fatal(err)
		}
	}
}
func insertAudit(t *testing.T, db *sql.DB, id string) {
	t.Helper()
	dialect := "mysql"
	if strings.Contains(fmt.Sprintf("%T", db.Driver()), "stdlib") {
		dialect = "postgres"
	}
	query := auditInsertSQL(dialect)
	if _, err := db.Exec(query, auditArgs(id)...); err != nil {
		t.Fatal(err)
	}
}
func auditInsertSQL(dialect string) string {
	query := "INSERT INTO audit_event (id,enterprise_id,application_instance_id,operation_id,stage,actor_id,actor_kind,action,resource_type,resource_id,outcome,reason,safe_diff,occurred_at,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)"
	if dialect == "postgres" {
		return postgresPlaceholders(query)
	}
	return query
}
func auditArgs(id string) []any {
	dialect := "mysql"
	if strings.HasSuffix(id, "postgres") || strings.Contains(id, "postgres-") {
		dialect = "postgres"
	}
	_ = dialect
	now := time.Now().UTC()
	enterprise := "ent-audit-mysql"
	instance := "ins-audit-mysql"
	if strings.Contains(id, "postgres") {
		enterprise = "ent-audit-postgres"
		instance = "ins-audit-postgres"
	}
	return []any{id, enterprise, instance, "operation-grants", "product_event", "machine", "service", "project.read", "project", "project-1", "success", "", `[]`, now, now}
}
func mustFail(t *testing.T, db *sql.DB, query string, args ...any) {
	t.Helper()
	if strings.Contains(fmt.Sprintf("%T", db.Driver()), "stdlib") {
		query = postgresPlaceholders(query)
	}
	if _, err := db.Exec(query, args...); err == nil {
		t.Fatalf("expected privilege failure: %s", query)
	}
}
func mustSucceed(t *testing.T, db *sql.DB, query string, args ...any) {
	t.Helper()
	if strings.Contains(fmt.Sprintf("%T", db.Driver()), "stdlib") {
		query = postgresPlaceholders(query)
	}
	if _, err := db.Exec(query, args...); err != nil {
		t.Fatal(err)
	}
}
func assertNoTruncate(t *testing.T, db *sql.DB, dialect string) {
	t.Helper()
	if dialect == "postgres" {
		var allowed bool
		if err := db.QueryRow("SELECT has_table_privilege('ecp_tx_writer','audit_event','TRUNCATE')").Scan(&allowed); err != nil {
			t.Fatal(err)
		}
		if allowed {
			t.Fatal("ecp_tx_writer has TRUNCATE")
		}
		return
	}
	var count int
	if err := db.QueryRow("SELECT COUNT(*) FROM information_schema.table_privileges WHERE table_schema=DATABASE() AND table_name='audit_event' AND grantee LIKE ? AND privilege_type='DROP'", "%ecp_tx_writer%").Scan(&count); err != nil {
		t.Fatal(err)
	}
	if count != 0 {
		t.Fatal("ecp_tx_writer has DROP/TRUNCATE capability")
	}
}
func postgresPlaceholders(query string) string {
	index := 0
	for strings.Contains(query, "?") {
		index++
		query = strings.Replace(query, "?", fmt.Sprintf("$%d", index), 1)
	}
	return query
}
