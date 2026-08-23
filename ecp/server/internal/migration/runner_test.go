package migration

import (
	"os"
	"testing"
)

func TestUnsupportedDriverFailsBeforeConnecting(t *testing.T) {
	if err := Up("sqlite", "unused"); err == nil {
		t.Fatal("expected unsupported migration driver error")
	}
}

func TestMigrationRoundTrip(t *testing.T) {
	for _, test := range []struct {
		name   string
		driver string
		env    string
	}{
		{name: "postgres", driver: "postgres", env: "ECP_TEST_POSTGRES_MIGRATION_DSN"},
		{name: "mysql", driver: "mysql", env: "ECP_TEST_MYSQL_MIGRATION_DSN"},
	} {
		t.Run(test.name, func(t *testing.T) {
			dsn := os.Getenv(test.env)
			if dsn == "" {
				t.Skipf("%s is not configured", test.env)
			}
			if err := Up(test.driver, dsn); err != nil {
				t.Fatal(err)
			}
			version, dirty, err := Version(test.driver, dsn)
			if err != nil {
				t.Fatal(err)
			}
			if version != 1 || dirty {
				t.Fatalf("version=%d dirty=%v", version, dirty)
			}
			if err := Down(test.driver, dsn, 1); err != nil {
				t.Fatal(err)
			}
			version, dirty, err = Version(test.driver, dsn)
			if err != nil {
				t.Fatal(err)
			}
			if version != 0 || dirty {
				t.Fatalf("down version=%d dirty=%v", version, dirty)
			}
			if err := Up(test.driver, dsn); err != nil {
				t.Fatal(err)
			}
		})
	}
}
