package main

import (
	"bytes"
	"context"
	"crypto/ed25519"
	"encoding/base64"
	"encoding/json"
	"flag"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/xfzen/ecp/server/internal/domain"
	connectorservice "github.com/xfzen/ecp/server/internal/service/connector"
)

func main() {
	if len(os.Args) < 2 || os.Args[1] != "sign-and-publish" {
		fail("usage: keyset-maintain sign-and-publish [flags]")
	}
	flags := flag.NewFlagSet("sign-and-publish", flag.ExitOnError)
	input := flags.String("input", "", "unsigned key-set JSON")
	endpoint := flags.String("endpoint", "", "ECP publish endpoint")
	rootReference := flags.String("root-secret-ref", "", "offline root secret reference")
	credentialID := flags.String("credential-id", "", "operator credential ID")
	credentialReference := flags.String("credential-secret-ref", "", "operator credential secret reference")
	_ = flags.Parse(os.Args[2:])
	if *input == "" || *endpoint == "" || *rootReference == "" || *credentialID == "" || *credentialReference == "" {
		fail("all flags are required")
	}
	provider := envSecretProvider{}
	rootRaw, err := provider.Get(context.Background(), *rootReference)
	if err != nil {
		fail(err.Error())
	}
	rootDecoded, err := base64.RawURLEncoding.DecodeString(string(rootRaw))
	if err != nil || len(rootDecoded) != ed25519.PrivateKeySize {
		fail("invalid offline root private key")
	}
	data, err := os.ReadFile(*input)
	if err != nil {
		fail(err.Error())
	}
	var keyset domain.DelegationKeySet
	if err := json.Unmarshal(data, &keyset); err != nil {
		fail(err.Error())
	}
	envelope, err := connectorservice.SignKeySetEnvelope(ed25519.PrivateKey(rootDecoded), keyset)
	if err != nil {
		fail(err.Error())
	}
	credential, err := provider.Get(context.Background(), *credentialReference)
	if err != nil {
		fail(err.Error())
	}
	body, _ := json.Marshal(envelope)
	request, err := http.NewRequestWithContext(context.Background(), http.MethodPost, *endpoint, bytes.NewReader(body))
	if err != nil {
		fail(err.Error())
	}
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("X-ECP-Operator-ID", *credentialID)
	request.Header.Set("Authorization", "Bearer "+string(credential))
	client := &http.Client{Timeout: 15 * time.Second}
	response, err := client.Do(request)
	if err != nil {
		fail(err.Error())
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		fail(fmt.Sprintf("publish status %d", response.StatusCode))
	}
}

type envSecretProvider struct{}

func (envSecretProvider) Get(_ context.Context, reference string) ([]byte, error) {
	if !strings.HasPrefix(reference, "env://") {
		return nil, fmt.Errorf("unsupported secret reference")
	}
	value := os.Getenv(strings.TrimPrefix(reference, "env://"))
	if value == "" {
		return nil, fmt.Errorf("secret unavailable")
	}
	return []byte(value), nil
}
func fail(message string) { _, _ = fmt.Fprintln(os.Stderr, message); os.Exit(1) }
