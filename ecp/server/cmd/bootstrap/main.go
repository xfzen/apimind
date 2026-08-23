package main

import (
	"context"
	"flag"
	"fmt"
	"os"
	"strings"

	"github.com/xfzen/ecp/server/config"
	persistence "github.com/xfzen/ecp/server/internal/infra/persistence/gorm"
	oidcclientservice "github.com/xfzen/ecp/server/internal/service/oidcclient"
	registryservice "github.com/xfzen/ecp/server/internal/service/registry"
)

func main() {
	driver := flag.String("driver", "postgres", "database driver")
	dsnFile := flag.String("dsn-file", "", "database DSN file")
	enterpriseID := flag.String("enterprise", "", "enterprise ID")
	enterpriseName := flag.String("enterprise-name", "", "enterprise name")
	applicationID := flag.String("application", "ecp-control", "control application ID")
	instanceID := flag.String("instance", "ecp-admin", "admin UI instance ID")
	clientRecordID := flag.String("client-record", "", "OIDC client record ID")
	clientID := flag.String("client-id", "", "OIDC client ID")
	secretReference := flag.String("secret-reference", "", "OIDC client secret reference")
	redirectURI := flag.String("redirect-uri", "", "OIDC redirect URI")
	localMode := flag.Bool("local-mode", false, "allow loopback HTTP redirect")
	flag.Parse()

	if *dsnFile == "" || *enterpriseID == "" || *enterpriseName == "" || *clientRecordID == "" || *clientID == "" || *secretReference == "" || *redirectURI == "" {
		fail("missing required bootstrap argument")
	}
	dsn, err := os.ReadFile(*dsnFile)
	if err != nil {
		fail(err.Error())
	}
	db, err := persistence.Open(config.DatabaseConfig{Driver: *driver, DSN: strings.TrimSpace(string(dsn))})
	if err != nil {
		fail(err.Error())
	}
	sqlDB, err := db.DB()
	if err == nil {
		defer sqlDB.Close()
	}

	ctx := context.Background()
	registryStore := persistence.NewRegistryStore(db)
	registry := registryservice.New(registryStore)
	if _, found, err := registryStore.GetEnterprise(ctx, *enterpriseID); err != nil {
		fail(err.Error())
	} else if !found {
		if _, err := registry.RegisterEnterprise(ctx, registryservice.RegisterEnterpriseInput{ID: *enterpriseID, Name: *enterpriseName}); err != nil {
			fail(err.Error())
		}
	}
	if _, found, err := registryStore.GetApplication(ctx, *enterpriseID, *applicationID); err != nil {
		fail(err.Error())
	} else if !found {
		if _, err := registry.RegisterApplication(ctx, registryservice.RegisterApplicationInput{ID: *applicationID, EnterpriseID: *enterpriseID, Key: "ecp-control", Name: "ECP Control Plane"}); err != nil {
			fail(err.Error())
		}
	}
	if _, found, err := registryStore.GetInstance(ctx, *enterpriseID, *instanceID); err != nil {
		fail(err.Error())
	} else if !found {
		if _, err := registry.RegisterInstance(ctx, registryservice.RegisterInstanceInput{ID: *instanceID, EnterpriseID: *enterpriseID, ApplicationID: *applicationID, InstanceKey: "admin-ui", Environment: "local", CanonicalURL: "https://ecp-admin.local"}); err != nil {
			fail(err.Error())
		}
	}
	oidcStore := persistence.NewOIDCClientStore(db)
	if _, found, err := oidcStore.Get(ctx, *enterpriseID, *clientRecordID); err != nil {
		fail(err.Error())
	} else if !found {
		oidc := oidcclientservice.New(oidcStore, *localMode)
		if _, err := oidc.Register(ctx, oidcclientservice.RegisterInput{ID: *clientRecordID, EnterpriseID: *enterpriseID, ApplicationID: *applicationID, InstanceID: *instanceID, ClientID: *clientID, SecretReference: *secretReference, RedirectURIs: []string{*redirectURI}}); err != nil {
			fail(err.Error())
		}
	}
	fmt.Println("ECP bootstrap completed")
}

func fail(message string) {
	_, _ = fmt.Fprintln(os.Stderr, message)
	os.Exit(1)
}
