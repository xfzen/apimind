package migration

import (
	"database/sql"
	"errors"
	"fmt"
	"io/fs"

	"github.com/xfzen/ecp/server/migrations"

	_ "github.com/go-sql-driver/mysql"
	"github.com/golang-migrate/migrate/v4"
	"github.com/golang-migrate/migrate/v4/database"
	mysqlmigrate "github.com/golang-migrate/migrate/v4/database/mysql"
	postgresmigrate "github.com/golang-migrate/migrate/v4/database/postgres"
	"github.com/golang-migrate/migrate/v4/source/iofs"
	_ "github.com/jackc/pgx/v5/stdlib"
)

func Up(driver, dsn string) error {
	return withRunner(driver, dsn, func(runner *migrate.Migrate) error {
		err := runner.Up()
		if errors.Is(err, migrate.ErrNoChange) {
			return nil
		}
		return err
	})
}

func Down(driver, dsn string, steps int) error {
	if steps <= 0 {
		return fmt.Errorf("down steps must be positive")
	}
	return withRunner(driver, dsn, func(runner *migrate.Migrate) error {
		err := runner.Steps(-steps)
		if errors.Is(err, migrate.ErrNoChange) {
			return nil
		}
		return err
	})
}

func Version(driver, dsn string) (uint, bool, error) {
	var version uint
	var dirty bool
	err := withRunner(driver, dsn, func(runner *migrate.Migrate) error {
		current, isDirty, err := runner.Version()
		if errors.Is(err, migrate.ErrNilVersion) {
			version, dirty = 0, false
			return nil
		}
		version, dirty = current, isDirty
		return err
	})
	return version, dirty, err
}

func withRunner(driver, dsn string, fn func(*migrate.Migrate) error) error {
	runner, err := newRunner(driver, dsn)
	if err != nil {
		return err
	}
	defer runner.Close()
	if err := fn(runner); err != nil {
		return fmt.Errorf("migrate %s: %w", driver, err)
	}
	return nil
}

func newRunner(driver, dsn string) (*migrate.Migrate, error) {
	var (
		sourceDir string
		sqlDriver string
	)
	switch driver {
	case "postgres":
		sourceDir = "postgres"
		sqlDriver = "pgx"
	case "mysql":
		sourceDir = "mysql"
		sqlDriver = "mysql"
	default:
		return nil, fmt.Errorf("unsupported migration driver %q", driver)
	}
	sourceFS, err := fs.Sub(migrations.FS, sourceDir)
	if err != nil {
		return nil, fmt.Errorf("select %s migrations: %w", driver, err)
	}
	sourceDriver, err := iofs.New(sourceFS, ".")
	if err != nil {
		return nil, fmt.Errorf("open embedded migrations: %w", err)
	}
	db, err := sql.Open(sqlDriver, dsn)
	if err != nil {
		return nil, fmt.Errorf("open migration database: %w", err)
	}
	var databaseDriverName string
	var databaseDriver database.Driver
	switch driver {
	case "postgres":
		databaseDriverName = "postgres"
		databaseDriver, err = postgresmigrate.WithInstance(db, &postgresmigrate.Config{})
	case "mysql":
		databaseDriverName = "mysql"
		databaseDriver, err = mysqlmigrate.WithInstance(db, &mysqlmigrate.Config{})
	}
	if err != nil {
		_ = sourceDriver.Close()
		_ = db.Close()
		return nil, fmt.Errorf("initialize %s migration driver: %w", driver, err)
	}
	runner, err := migrate.NewWithInstance("iofs", sourceDriver, databaseDriverName, databaseDriver)
	if err != nil {
		_ = sourceDriver.Close()
		_ = databaseDriver.Close()
		return nil, fmt.Errorf("create migration runner: %w", err)
	}
	return runner, nil
}
