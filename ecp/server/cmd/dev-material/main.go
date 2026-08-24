package main

import (
	"crypto/ed25519"
	"crypto/rand"
	"encoding/base64"
	"flag"
	"fmt"
	"os"
	"path/filepath"

	connectorservice "github.com/xfzen/ecp/server/internal/service/connector"
)

func main() {
	output := flag.String("output", "", "checkout-local output directory")
	flag.Parse()
	if *output == "" {
		fail("output directory is required")
	}
	if err := os.MkdirAll(*output, 0o700); err != nil {
		fail(err.Error())
	}
	rootPublicName := filepath.Join(*output, "delegation-root-public.local.secret")
	rootPrivateName := filepath.Join(*output, "delegation-root-private.local.secret")
	rootFingerprintName := filepath.Join(*output, "delegation-root-fingerprint.local.secret")
	if !exists(rootPublicName) || !exists(rootPrivateName) || !exists(rootFingerprintName) {
		publicKey, privateKey, err := ed25519.GenerateKey(rand.Reader)
		if err != nil {
			fail(err.Error())
		}
		write(rootPublicName, base64.RawURLEncoding.EncodeToString(publicKey))
		write(rootPrivateName, base64.RawURLEncoding.EncodeToString(privateKey))
		write(rootFingerprintName, connectorservice.Fingerprint(publicKey))
	}
	if name := filepath.Join(*output, "delegation-signing-private.local.secret"); !exists(name) {
		_, privateKey, err := ed25519.GenerateKey(rand.Reader)
		if err != nil {
			fail(err.Error())
		}
		write(name, base64.RawURLEncoding.EncodeToString(privateKey))
	}
	for _, name := range []string{"product-connector.local.secret", "product-callback.local.secret", "apimind-oidc.local.secret"} {
		fullName := filepath.Join(*output, name)
		if exists(fullName) {
			continue
		}
		value := make([]byte, 32)
		if _, err := rand.Read(value); err != nil {
			fail(err.Error())
		}
		write(fullName, base64.RawURLEncoding.EncodeToString(value))
	}
	fmt.Println("enterprise development trust material is ready")
}

func exists(name string) bool {
	info, err := os.Stat(name)
	return err == nil && info.Mode().IsRegular() && info.Size() > 0
}

func write(name, value string) {
	if err := os.WriteFile(name, []byte(value+"\n"), 0o600); err != nil {
		fail(err.Error())
	}
}

func fail(message string) {
	_, _ = fmt.Fprintln(os.Stderr, message)
	os.Exit(1)
}
