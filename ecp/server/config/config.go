package config

import "github.com/zeromicro/go-zero/rest"

type Config struct {
	rest.RestConf
	Build BuildConfig
}

type BuildConfig struct {
	Version string
}
