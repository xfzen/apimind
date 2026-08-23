package policy

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/xfzen/ecp/server/internal/domain"
	"github.com/xfzen/ecp/server/internal/infra/casdoor"
)

type Store interface {
	Get(context.Context, string, string) (domain.PolicyProjection, bool, error)
	Put(context.Context, domain.PolicyProjection) (domain.PolicyProjection, error)
}
type Adapter interface {
	ReadPolicies(context.Context) ([]casdoor.Policy, error)
	WritePolicies(context.Context, []casdoor.Policy) error
	DeletePolicies(context.Context, []casdoor.Policy) error
}
type Service struct {
	store   Store
	adapter Adapter
}

func New(store Store, adapter Adapter) *Service { return &Service{store: store, adapter: adapter} }

type ReconcileInput struct {
	EnterpriseID, ApplicationInstanceID string
	ManifestVersion                     uint64
	Policies                            []casdoor.Policy
}

func (s *Service) Reconcile(ctx context.Context, input ReconcileInput) (domain.PolicyProjection, error) {
	if s == nil || s.store == nil || s.adapter == nil || input.EnterpriseID == "" || input.ApplicationInstanceID == "" {
		return domain.PolicyProjection{}, fmt.Errorf("policy_service_unavailable")
	}
	prefix := "ecp:" + input.ApplicationInstanceID + ":"
	desired := normalize(input.Policies, prefix)
	desiredHash := canonicalHash(desired)
	existing, err := s.adapter.ReadPolicies(ctx)
	if err != nil {
		return domain.PolicyProjection{}, err
	}
	scoped := filter(existing, prefix)
	if len(scoped) > 0 {
		if err := s.adapter.DeletePolicies(ctx, scoped); err != nil {
			return domain.PolicyProjection{}, err
		}
	}
	if len(desired) > 0 {
		if err := s.adapter.WritePolicies(ctx, desired); err != nil {
			return domain.PolicyProjection{}, err
		}
	}
	readback, err := s.adapter.ReadPolicies(ctx)
	if err != nil {
		return domain.PolicyProjection{}, err
	}
	actual := filter(readback, prefix)
	actualHash := canonicalHash(actual)
	value, found, err := s.store.Get(ctx, input.EnterpriseID, input.ApplicationInstanceID)
	if err != nil {
		return domain.PolicyProjection{}, err
	}
	now := time.Now().UTC()
	if !found {
		value = domain.PolicyProjection{Base: domain.Base{ID: newID(), EnterpriseID: input.EnterpriseID, CreatedAt: now}, ApplicationInstanceID: input.ApplicationInstanceID}
	}
	value.ManifestVersion = input.ManifestVersion
	value.PolicyVersion++
	value.NormalizedHash = actualHash
	value.CasdoorPolicyIDs = policyIDs(actual)
	value.UpdatedAt = now
	value.ReconciliationState = "in_sync"
	value.LastError = ""
	if actualHash != desiredHash {
		value.ReconciliationState = "drifted"
		value.LastError = "canonical readback mismatch"
	}
	persisted, err := s.store.Put(ctx, value)
	if err != nil {
		return domain.PolicyProjection{}, err
	}
	if persisted.ReconciliationState != "in_sync" {
		return persisted, fmt.Errorf("policy_readback_mismatch")
	}
	return persisted, nil
}
func normalize(values []casdoor.Policy, prefix string) []casdoor.Policy {
	result := append([]casdoor.Policy(nil), values...)
	for i := range result {
		if !strings.HasPrefix(result[i].Name, prefix) {
			result[i].Name = prefix + result[i].Name
		}
	}
	sortPolicies(result)
	return result
}
func filter(values []casdoor.Policy, prefix string) []casdoor.Policy {
	var result []casdoor.Policy
	for _, value := range values {
		if strings.HasPrefix(value.Name, prefix) {
			result = append(result, value)
		}
	}
	sortPolicies(result)
	return result
}
func sortPolicies(values []casdoor.Policy) {
	sort.Slice(values, func(i, j int) bool {
		left, _ := json.Marshal(values[i])
		right, _ := json.Marshal(values[j])
		return string(left) < string(right)
	})
}
func canonicalHash(values []casdoor.Policy) string {
	payload, _ := json.Marshal(values)
	digest := sha256.Sum256(payload)
	return hex.EncodeToString(digest[:])
}
func policyIDs(values []casdoor.Policy) []string {
	result := make([]string, 0, len(values))
	for _, value := range values {
		result = append(result, value.Name)
	}
	return result
}
func newID() string {
	value := make([]byte, 16)
	if _, err := rand.Read(value); err != nil {
		panic(err)
	}
	return "pol_" + hex.EncodeToString(value)
}
