package config

import (
	"time"

	"github.com/zeromicro/go-zero/rest"
)

type Config struct {
	rest.RestConf
	Build    BuildConfig
	Database DatabaseConfig `json:",optional"`
}

type DatabaseConfig struct {
	Enabled         bool          `json:",default=false"`
	Driver          string        `json:",optional"`
	DSN             string        `json:",optional"`
	MaxOpenConns    int           `json:",default=20"`
	MaxIdleConns    int           `json:",default=5"`
	ConnMaxLifetime time.Duration `json:",default=30m"`
}

type BuildConfig struct {
	Version string
}
