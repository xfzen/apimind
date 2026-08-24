package persistence

import (
	"strings"
	"testing"
)

func TestAuditInsertDoesNotRequireReadPrivilege(t *testing.T) {
	for _, dialect := range []string{"postgres", "mysql"} {
		statement, err := auditInsertStatement(dialect, false)
		if err != nil {
			t.Fatal(err)
		}
		if strings.Contains(strings.ToUpper(statement), "RETURNING") {
			t.Fatalf("%s insert requests readback: %s", dialect, statement)
		}
	}
}

func TestAuditInsertOnceUsesDialectIdempotency(t *testing.T) {
	postgres, err := auditInsertStatement("postgres", true)
	if err != nil || !strings.Contains(postgres, "ON CONFLICT (id) DO NOTHING") {
		t.Fatalf("postgres=%q err=%v", postgres, err)
	}
	mysql, err := auditInsertStatement("mysql", true)
	if err != nil || !strings.HasPrefix(mysql, "INSERT IGNORE") {
		t.Fatalf("mysql=%q err=%v", mysql, err)
	}
}
