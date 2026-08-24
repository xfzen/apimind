package main

import (
	"context"
	"flag"
	"fmt"
	"os"
	"strings"

	"github.com/xfzen/ecp/server/config"
	persistence "github.com/xfzen/ecp/server/internal/infra/persistence/gorm"
	identityservice "github.com/xfzen/ecp/server/internal/service/identity"
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
	adminIssuer := flag.String("admin-issuer", "", "initial administrator OIDC issuer")
	adminSubject := flag.String("admin-subject", "", "initial administrator immutable OIDC subject")
	adminEmail := flag.String("admin-email", "", "initial administrator verified email")
	adminDisplayName := flag.String("admin-display-name", "", "initial administrator display name")
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
	oidc := oidcclientservice.New(persistence.NewOIDCClientStore(db), *localMode)
	if _, err := oidc.Ensure(ctx, oidcclientservice.RegisterInput{ID: *clientRecordID, EnterpriseID: *enterpriseID, ApplicationID: *applicationID, InstanceID: *instanceID, ClientID: *clientID, SecretReference: *secretReference, RedirectURIs: []string{*redirectURI}}); err != nil {
		fail(err.Error())
	}
	adminFields := []string{strings.TrimSpace(*adminIssuer), strings.TrimSpace(*adminSubject), strings.TrimSpace(*adminEmail)}
	if adminFields[0] != "" || adminFields[1] != "" || adminFields[2] != "" {
		if adminFields[0] == "" || adminFields[1] == "" || adminFields[2] == "" {
			fail("admin issuer, subject, and email must be provided together")
		}
		identities := identityservice.NewWithOptions(persistence.NewIdentityStore(db), []string{adminFields[0]}, *localMode)
		if _, err := identities.AdmitJIT(ctx, identityservice.JITInput{
			EnterpriseID: *enterpriseID, ApplicationID: *applicationID, Issuer: adminFields[0], Subject: adminFields[1],
			Email: adminFields[2], EmailVerified: true, DisplayName: strings.TrimSpace(*adminDisplayName),
		}); err != nil {
			fail(err.Error())
		}
	}
	fmt.Println("ECP bootstrap completed")
}

func fail(message string) {
	_, _ = fmt.Fprintln(os.Stderr, message)
	os.Exit(1)
}
