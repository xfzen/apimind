package main

import (
	"context"
	"crypto/ed25519"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"flag"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/xfzen/ecp/server/config"
	"github.com/xfzen/ecp/server/internal/domain"
	"github.com/xfzen/ecp/server/internal/infra/casdoor"
	persistence "github.com/xfzen/ecp/server/internal/infra/persistence/gorm"
	connectorservice "github.com/xfzen/ecp/server/internal/service/connector"
	oidcclientservice "github.com/xfzen/ecp/server/internal/service/oidcclient"
	registryservice "github.com/xfzen/ecp/server/internal/service/registry"
)

func main() {
	driver := flag.String("driver", "postgres", "database driver")
	dsnFile := flag.String("dsn-file", "", "database DSN file")
	enterpriseID := flag.String("enterprise", "", "enterprise ID")
	applicationID := flag.String("application", "", "application ID")
	applicationKey := flag.String("application-key", "", "application key")
	applicationName := flag.String("application-name", "", "application display name")
	instanceID := flag.String("instance", "", "application instance ID")
	instanceKey := flag.String("instance-key", "", "application instance key")
	canonicalURL := flag.String("canonical-url", "", "application canonical URL")
	manifestFile := flag.String("manifest-file", "", "product Manifest file")
	clientRecordID := flag.String("client-record", "", "product OIDC client record ID")
	clientID := flag.String("client-id", "", "product OIDC client ID")
	clientSecretReference := flag.String("client-secret-reference", "", "product OIDC secret reference")
	redirectURI := flag.String("redirect-uri", "", "product OIDC callback URI")
	connectorID := flag.String("connector-id", "", "product-to-ECP credential and Connector ID")
	connectorKey := flag.String("connector-key", "primary", "Connector key")
	connectorSecretFile := flag.String("connector-secret-file", "", "product-to-ECP secret file")
	callbackClientID := flag.String("callback-client-id", "", "ECP-to-product client ID")
	callbackSecretFile := flag.String("callback-secret-file", "", "ECP-to-product secret file")
	rootPublicKeyFile := flag.String("root-public-key-file", "", "delegation root public key file")
	rootPrivateKeyFile := flag.String("root-private-key-file", "", "offline delegation root private key file")
	signingPrivateKeyFile := flag.String("signing-private-key-file", "", "online delegation signing private key file")
	signingKeyID := flag.String("signing-key-id", "local-signing-key", "delegation signing key ID")
	localMode := flag.Bool("local-mode", false, "allow loopback HTTP redirect")
	casdoorBaseURL := flag.String("casdoor-base-url", "", "Casdoor management API base URL")
	casdoorOrganization := flag.String("casdoor-organization", "", "Casdoor organization")
	casdoorClientID := flag.String("casdoor-client-id", "", "Casdoor management client ID")
	casdoorSecretFile := flag.String("casdoor-secret-file", "", "Casdoor management client secret file")
	casdoorBoundaryName := flag.String("casdoor-boundary-name", "", "dedicated Casdoor model, adapter, enforcer, and permission name")
	casdoorAllowedInsecureHost := flag.String("casdoor-allowed-insecure-host", "", "explicit local Casdoor HTTP host")
	flag.Parse()

	required := []*string{dsnFile, enterpriseID, applicationID, applicationKey, applicationName, instanceID, instanceKey, canonicalURL, manifestFile, clientRecordID, clientID, clientSecretReference, redirectURI, connectorID, connectorSecretFile, callbackClientID, callbackSecretFile, rootPublicKeyFile, rootPrivateKeyFile, signingPrivateKeyFile, signingKeyID}
	for _, value := range required {
		if strings.TrimSpace(*value) == "" {
			fail("missing required product bootstrap argument")
		}
	}

	db, err := persistence.Open(config.DatabaseConfig{Driver: *driver, DSN: readText(*dsnFile)})
	if err != nil {
		fail(err.Error())
	}
	if sqlDB, sqlErr := db.DB(); sqlErr == nil {
		defer sqlDB.Close()
	}
	ctx := context.Background()
	registryStore := persistence.NewRegistryStore(db)
	registry := registryservice.New(registryStore)
	if _, found, err := registryStore.GetEnterprise(ctx, *enterpriseID); err != nil || !found {
		fail("enterprise must be bootstrapped before product registration")
	}
	if _, found, err := registryStore.GetApplication(ctx, *enterpriseID, *applicationID); err != nil {
		fail(err.Error())
	} else if !found {
		if _, err := registry.RegisterApplication(ctx, registryservice.RegisterApplicationInput{ID: *applicationID, EnterpriseID: *enterpriseID, Key: *applicationKey, Name: *applicationName}); err != nil {
			fail(err.Error())
		}
	}
	if _, found, err := registryStore.GetInstance(ctx, *enterpriseID, *instanceID); err != nil {
		fail(err.Error())
	} else if !found {
		if _, err := registry.RegisterInstance(ctx, registryservice.RegisterInstanceInput{ID: *instanceID, EnterpriseID: *enterpriseID, ApplicationID: *applicationID, InstanceKey: *instanceKey, Environment: "local", CanonicalURL: *canonicalURL}); err != nil {
			fail(err.Error())
		}
	}
	manifestBody, err := os.ReadFile(*manifestFile)
	if err != nil {
		fail(err.Error())
	}
	if _, err := registry.EnsureManifest(ctx, registryservice.PutManifestInput{EnterpriseID: *enterpriseID, ApplicationID: *applicationID, APIVersion: "connector.manifest/v1", Body: manifestBody}); err != nil {
		fail(err.Error())
	}
	if _, err := registry.EnsureConnector(ctx, registryservice.RegisterConnectorInput{ID: *connectorID, EnterpriseID: *enterpriseID, ApplicationID: *applicationID, InstanceID: *instanceID, ConnectorKey: *connectorKey}); err != nil {
		fail(err.Error())
	}
	if _, err := oidcclientservice.New(persistence.NewOIDCClientStore(db), *localMode).Ensure(ctx, oidcclientservice.RegisterInput{ID: *clientRecordID, EnterpriseID: *enterpriseID, ApplicationID: *applicationID, InstanceID: *instanceID, ClientID: *clientID, SecretReference: *clientSecretReference, RedirectURIs: []string{*redirectURI}}); err != nil {
		fail(err.Error())
	}

	rootPublic := decodeKey(readText(*rootPublicKeyFile), ed25519.PublicKeySize, "root public key")
	rootPrivate := decodeKey(readText(*rootPrivateKeyFile), ed25519.PrivateKeySize, "root private key")
	if !ed25519.PublicKey(rootPrivate[32:]).Equal(ed25519.PublicKey(rootPublic)) {
		fail("delegation root key pair does not match")
	}
	signingPrivate := decodeKey(readText(*signingPrivateKeyFile), ed25519.PrivateKeySize, "signing private key")
	now := time.Now().UTC()
	connectorStore := persistence.NewConnectorStore(db)
	connectors := connectorservice.New(connectorStore, fileProvider{}, connectorservice.Config{Issuer: "ecp", RootPublicKeyReference: "file://" + *rootPublicKeyFile, RootFingerprint: connectorservice.Fingerprint(ed25519.PublicKey(rootPublic)), SigningPrivateKeyReference: "file://" + *signingPrivateKeyFile, ActiveSigningKeyID: *signingKeyID})
	if _, err := connectors.ProvisionChannel(ctx, connectorservice.ProvisionChannelInput{ID: *connectorID, EnterpriseID: *enterpriseID, ApplicationID: *applicationID, InstanceID: *instanceID, Channel: domain.TrustChannelInbound, Scopes: []string{"access.authorize", "audit.ingest", "credential.authenticate", "delegate.verify", "keyset.ack", "keyset.read", "lifecycle.read", "policy.read", "session.resolve"}, RawSecret: readText(*connectorSecretFile), ExpiresAt: now.AddDate(10, 0, 0)}); err != nil {
		fail(err.Error())
	}
	if _, err := connectors.ProvisionChannel(ctx, connectorservice.ProvisionChannelInput{ID: *callbackClientID, EnterpriseID: *enterpriseID, ApplicationID: *applicationID, InstanceID: *instanceID, Channel: domain.TrustChannelOutbound, Scopes: []string{"audit.flush", "projection.apply", "resource.ancestry", "resource.resolve", "resource.search"}, RawSecret: readText(*callbackSecretFile), ExpiresAt: now.AddDate(10, 0, 0)}); err != nil {
		fail(err.Error())
	}
	if _, found, err := connectorStore.LatestKeySet(ctx, domain.KeySetPurposeDelegation); err != nil {
		fail(err.Error())
	} else if !found {
		keyset := domain.DelegationKeySet{Version: 1, Purpose: domain.KeySetPurposeDelegation, SigningKeyID: *signingKeyID, Keys: []domain.DelegationVerificationKey{{KeyID: *signingKeyID, Algorithm: domain.AlgorithmEdDSA, PublicKey: base64.RawURLEncoding.EncodeToString(signingPrivate[32:]), NotBefore: now.Add(-time.Minute), NotAfter: now.AddDate(10, 0, 0), Status: domain.KeyStatusActive}}}
		envelope, err := connectorservice.SignKeySetEnvelope(ed25519.PrivateKey(rootPrivate), keyset)
		if err != nil {
			fail(err.Error())
		}
		if _, err := connectors.PublishDelegationKeySet(ctx, connectorservice.Claims{Channel: domain.TrustChannelKeySetOperator, Scopes: []string{"keyset.publish"}}, envelope); err != nil {
			fail(err.Error())
		}
	}
	if strings.TrimSpace(*casdoorBaseURL) != "" {
		casdoorValues := []*string{casdoorOrganization, casdoorClientID, casdoorSecretFile}
		for _, value := range casdoorValues {
			if strings.TrimSpace(*value) == "" {
				fail("incomplete Casdoor authorization bootstrap arguments")
			}
		}
		name := strings.TrimSpace(*casdoorBoundaryName)
		if name == "" {
			name = "ecp-" + *instanceID
		}
		digest := sha256.Sum256([]byte(*enterpriseID + "\x00" + *instanceID))
		client, err := casdoor.NewClient(casdoor.Config{BaseURL: *casdoorBaseURL, EnterpriseID: *enterpriseID, Organization: *casdoorOrganization, ClientID: *casdoorClientID, CredentialReference: "file://" + *casdoorSecretFile, LocalMode: *localMode, AllowedInsecureHosts: nonEmpty(*casdoorAllowedInsecureHost)}, fileProvider{}, nil)
		if err != nil {
			fail(err.Error())
		}
		boundary := casdoor.AuthorizationBoundary{Name: name, Table: "ecp_policy_" + hex.EncodeToString(digest[:8])}
		var lastErr error
		for attempt := 0; attempt < 30; attempt++ {
			lastErr = client.EnsureAuthorizationBoundary(ctx, boundary)
			if lastErr == nil {
				break
			}
			if strings.Contains(lastErr.Error(), "casdoor_boundary_conflict") {
				break
			}
			time.Sleep(2 * time.Second)
		}
		if lastErr != nil {
			fail(lastErr.Error())
		}
	}
	fmt.Println("ECP product bootstrap completed")
}

func nonEmpty(values ...string) []string {
	result := make([]string, 0, len(values))
	for _, value := range values {
		if value = strings.TrimSpace(value); value != "" {
			result = append(result, value)
		}
	}
	return result
}

type fileProvider struct{}

func (fileProvider) Get(_ context.Context, reference string) ([]byte, error) {
	if !strings.HasPrefix(reference, "file://") {
		return nil, fmt.Errorf("unsupported secret reference")
	}
	return []byte(readText(strings.TrimPrefix(reference, "file://"))), nil
}

func readText(name string) string {
	value, err := os.ReadFile(name)
	if err != nil {
		fail(err.Error())
	}
	if strings.TrimSpace(string(value)) == "" {
		fail("secret or input file is empty")
	}
	return strings.TrimSpace(string(value))
}

func decodeKey(raw string, size int, label string) []byte {
	value, err := base64.RawURLEncoding.DecodeString(raw)
	if err != nil || len(value) != size {
		fail("invalid " + label)
	}
	return value
}

func fail(message string) {
	_, _ = fmt.Fprintln(os.Stderr, message)
	os.Exit(1)
}
