package connectorMachine

import (
	"bytes"
	"encoding/json"
	"testing"

	"github.com/xfzen/ecp/server/internal/domain"
)

func TestKeySetResponseReturnsExactSignedEnvelope(t *testing.T) {
	payload := []byte(`{"version":1,"purpose":"delegation"}`)
	response := keySetResponse(domain.DelegationKeySet{Algorithm: domain.AlgorithmEdDSA, SigningKeyID: "root-1", SignedPayload: payload, RootSignature: "signature"}, "root-fingerprint")
	wire, err := json.Marshal(response)
	if err != nil {
		t.Fatal(err)
	}
	var decoded struct {
		Algorithm    string `json:"alg"`
		SigningKeyID string `json:"signing_kid"`
		Payload      []byte `json:"payload"`
		Signature    string `json:"signature"`
	}
	if err := json.Unmarshal(wire, &decoded); err != nil {
		t.Fatal(err)
	}
	if decoded.Algorithm != domain.AlgorithmEdDSA || decoded.SigningKeyID != "root-1" || !bytes.Equal(decoded.Payload, payload) || decoded.Signature != "signature" {
		t.Fatalf("decoded=%+v", decoded)
	}
}
