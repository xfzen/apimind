package migrations

import "embed"

// FS contains the versioned PostgreSQL and MySQL migration sources.
//
//go:embed postgres/*.sql mysql/*.sql
var FS embed.FS
