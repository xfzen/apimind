package main

import (
	"flag"
	"fmt"

	"github.com/xfzen/ecp/server/api/internal/handler"
	"github.com/xfzen/ecp/server/api/internal/svc"
	"github.com/xfzen/ecp/server/config"
	"github.com/xfzen/ecp/server/internal/httpserver"

	"github.com/zeromicro/go-zero/rest"
)

var configFile = flag.String("f", "etc/ecp.yaml", "configuration file")

func main() {
	flag.Parse()
	cfg := config.MustLoad(*configFile)
	httpserver.ConfigureRequestLogging(&cfg.RestConf)
	server := rest.MustNewServer(cfg.RestConf)
	defer server.Stop()
	server.Use(rest.ToMiddleware(httpserver.RequestLog))

	ctx := svc.NewServiceContext(cfg)
	handler.RegisterHandlers(server, ctx)
	fmt.Printf("starting %s at %s:%d\n", cfg.Name, cfg.Host, cfg.Port)
	server.Start()
}
