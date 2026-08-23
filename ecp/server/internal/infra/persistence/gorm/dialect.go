package persistence

import (
	"errors"
	"fmt"
	"strings"
)

type Dialect string

const (
	DialectPostgres Dialect = "postgres"
	DialectMySQL    Dialect = "mysql"
)

var ErrUnsupportedDialect = errors.New("unsupported database dialect")

func ParseDialect(value string) (Dialect, error) {
	switch Dialect(strings.ToLower(strings.TrimSpace(value))) {
	case DialectPostgres:
		return DialectPostgres, nil
	case DialectMySQL:
		return DialectMySQL, nil
	default:
		return "", fmt.Errorf("%w: %q", ErrUnsupportedDialect, value)
	}
}
