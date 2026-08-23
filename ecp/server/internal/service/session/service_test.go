package session

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/xfzen/ecp/server/internal/domain"
)

type memoryStore struct {
	logins   map[string]domain.LoginTransaction
	products map[string]domain.ProductLoginTransaction
	sessions map[string]domain.Session
}

func (s *memoryStore) CreateLoginTransaction(_ context.Context, value domain.LoginTransaction) error {
	if s.logins == nil {
		s.logins = make(map[string]domain.LoginTransaction)
	}
	s.logins[value.ID] = value
	return nil
}
func (s *memoryStore) GetLoginTransaction(_ context.Context, id string) (domain.LoginTransaction, bool, error) {
	value, ok := s.logins[id]
	return value, ok, nil
}
func (s *memoryStore) MarkLoginTransactionUsed(_ context.Context, id string, usedAt time.Time) (bool, error) {
	value, ok := s.logins[id]
	if !ok || value.UsedAt != nil {
		return false, nil
	}
	value.UsedAt = &usedAt
	s.logins[id] = value
	return true, nil
}
func (s *memoryStore) CreateSession(_ context.Context, value domain.Session) error {
	if s.sessions == nil {
		s.sessions = make(map[string]domain.Session)
	}
	s.sessions[value.ID] = value
	return nil
}
func (s *memoryStore) GetSessionByTokenHash(_ context.Context, tokenHash string) (domain.Session, bool, error) {
	for _, value := range s.sessions {
		if value.TokenHash == tokenHash {
			return value, true, nil
		}
	}
	return domain.Session{}, false, nil
}
func (s *memoryStore) ListSessions(_ context.Context, enterpriseID string) ([]domain.Session, error) {
	var values []domain.Session
	for _, value := range s.sessions {
		if value.EnterpriseID == enterpriseID {
			values = append(values, value)
		}
	}
	return values, nil
}
func (s *memoryStore) RevokeSession(_ context.Context, enterpriseID, id string, revokedAt time.Time) (bool, error) {
	value, ok := s.sessions[id]
	if !ok || value.EnterpriseID != enterpriseID {
		return false, nil
	}
	value.RevokedAt = &revokedAt
	s.sessions[id] = value
	return true, nil
}
func (s *memoryStore) RevokeProductSessionByTokenHash(_ context.Context, enterpriseID, instanceID, tokenHash string, revokedAt time.Time) (bool, error) {
	for id, value := range s.sessions {
		if value.EnterpriseID == enterpriseID && value.ApplicationInstanceID == instanceID && value.Kind == ProductSession && value.TokenHash == tokenHash && value.RevokedAt == nil {
			value.RevokedAt = &revokedAt
			value.Version++
			s.sessions[id] = value
			return true, nil
		}
	}
	return false, nil
}
func (s *memoryStore) RevokePrincipalSessions(_ context.Context, enterpriseID, principalID string, revokedAt time.Time) (int64, error) {
	var count int64
	for id, value := range s.sessions {
		if value.EnterpriseID == enterpriseID && value.PrincipalID == principalID && value.RevokedAt == nil {
			value.RevokedAt = &revokedAt
			s.sessions[id] = value
			count++
		}
	}
	return count, nil
}
func (s *memoryStore) CreateProductTransaction(_ context.Context, value domain.ProductLoginTransaction) error {
	if s.products == nil {
		s.products = make(map[string]domain.ProductLoginTransaction)
	}
	s.products[value.ID] = value
	return nil
}
func (s *memoryStore) ConsumeProductTransaction(_ context.Context, codeHash, enterpriseID, instanceID string, usedAt time.Time) (domain.ProductLoginTransaction, bool, error) {
	for id, value := range s.products {
		if value.CodeHash == codeHash && value.UsedAt == nil && (enterpriseID == "" || value.EnterpriseID == enterpriseID) && (instanceID == "" || value.ApplicationInstanceID == instanceID) {
			value.UsedAt = &usedAt
			s.products[id] = value
			return value, true, nil
		}
	}
	return domain.ProductLoginTransaction{}, false, nil
}

type fakeClock struct{ now time.Time }

func (c *fakeClock) Now() time.Time { return c.now }

type fakeVerifier struct{ claims OIDCClaims }

func (v fakeVerifier) Verify(_ context.Context, _, _, _ string) (OIDCClaims, error) {
	return v.claims, nil
}

func TestOIDCCompleteValidatesStatePKCENonceAndAudience(t *testing.T) {
	clock := &fakeClock{now: time.Date(2026, 8, 23, 0, 0, 0, 0, time.UTC)}
	store := &memoryStore{}
	service := NewWithVerifier(store, clock, time.Hour, fakeVerifier{claims: OIDCClaims{PrincipalID: "principal-1", Audience: "admin-client", Nonce: "placeholder"}})
	begin, err := service.Begin(context.Background(), BeginInput{EnterpriseID: "ent-1", OIDCClientID: "oidc-1", Kind: AdminSession, RedirectURI: "https://admin.example.com/callback"})
	if err != nil {
		t.Fatal(err)
	}
	_, err = service.Complete(context.Background(), CompleteInput{TransactionID: begin.TransactionID, State: "wrong", PKCEVerifier: begin.PKCEVerifier, Nonce: begin.Nonce, Code: "code", ExpectedAudience: "admin-client"})
	assertReason(t, err, "oidc_state_mismatch")
	service.verifier = fakeVerifier{claims: OIDCClaims{PrincipalID: "principal-1", Audience: "admin-client", Nonce: begin.Nonce}}
	completed, err := service.Complete(context.Background(), CompleteInput{TransactionID: begin.TransactionID, State: begin.State, PKCEVerifier: begin.PKCEVerifier, Nonce: begin.Nonce, Code: "code", ExpectedAudience: "admin-client"})
	if err != nil {
		t.Fatal(err)
	}
	if completed.Kind != AdminSession || completed.ApplicationInstanceID != "" || completed.CookieName != AdminCookieName {
		t.Fatalf("unexpected session: %+v", completed)
	}
	_, err = service.Complete(context.Background(), CompleteInput{TransactionID: begin.TransactionID, State: begin.State, PKCEVerifier: begin.PKCEVerifier, Nonce: begin.Nonce, Code: "code", ExpectedAudience: "admin-client"})
	assertReason(t, err, "login_transaction_used")
}

func TestProductLoginTransactionIsSingleUse(t *testing.T) {
	clock := &fakeClock{now: time.Date(2026, 8, 23, 0, 0, 0, 0, time.UTC)}
	service := New(&memoryStore{}, clock, time.Hour)
	transaction, err := service.IssueProductTransaction(context.Background(), ProductTransactionInput{EnterpriseID: "ent-1", ApplicationInstanceID: "ins-1", PrincipalID: "principal-1"})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := service.ExchangeProductTransaction(context.Background(), transaction.Code); err != nil {
		t.Fatal(err)
	}
	_, err = service.ExchangeProductTransaction(context.Background(), transaction.Code)
	assertReason(t, err, "login_transaction_used")
}

func TestProductOIDCCallbackIssuesOneTimeExchangeWithoutCreatingSession(t *testing.T) {
	clock := &fakeClock{now: time.Date(2026, 8, 23, 0, 0, 0, 0, time.UTC)}
	store := &memoryStore{}
	service := New(store, clock, time.Hour)
	begin, err := service.Begin(context.Background(), BeginInput{EnterpriseID: "ent-1", OIDCClientID: "oidc-product", ApplicationInstanceID: "ins-1", Kind: ProductSession, RedirectURI: "https://product.example.com/api/enterprise/auth/callback"})
	if err != nil {
		t.Fatal(err)
	}
	verifier := fakeVerifier{claims: OIDCClaims{PrincipalID: "principal-1", Audience: "product-client", Nonce: begin.Nonce}}
	exchange, err := service.CompleteProduct(context.Background(), CompleteInput{TransactionID: begin.TransactionID, State: begin.State, PKCEVerifier: begin.PKCEVerifier, Nonce: begin.Nonce, Code: "code", ExpectedAudience: "product-client", Verifier: verifier})
	if err != nil {
		t.Fatal(err)
	}
	if len(store.sessions) != 0 {
		t.Fatalf("sessions created before exchange = %d", len(store.sessions))
	}
	productSession, err := service.ExchangeProductTransaction(context.Background(), exchange.Code)
	if err != nil {
		t.Fatal(err)
	}
	if productSession.Kind != ProductSession || productSession.ApplicationInstanceID != "ins-1" {
		t.Fatalf("session = %+v", productSession)
	}
}

func TestProductOIDCCallbackCannotCrossConnectorInstance(t *testing.T) {
	clock := &fakeClock{now: time.Date(2026, 8, 23, 0, 0, 0, 0, time.UTC)}
	service := New(&memoryStore{}, clock, time.Hour)
	begin, err := service.Begin(context.Background(), BeginInput{EnterpriseID: "ent-1", OIDCClientID: "oidc-product", ApplicationInstanceID: "ins-1", Kind: ProductSession, RedirectURI: "https://product.example.com/api/enterprise/auth/callback"})
	if err != nil {
		t.Fatal(err)
	}
	_, err = service.CompleteProduct(context.Background(), CompleteInput{TransactionID: begin.TransactionID, State: begin.State, PKCEVerifier: begin.PKCEVerifier, Nonce: begin.Nonce, Code: "code", ExpectedAudience: "product-client", ExpectedEnterpriseID: "ent-1", ExpectedApplicationInstanceID: "ins-2", ExpectedOIDCClientID: "oidc-product", Verifier: fakeVerifier{claims: OIDCClaims{PrincipalID: "principal-1", Audience: "product-client", Nonce: begin.Nonce}}})
	assertReason(t, err, "login_transaction_scope_mismatch")
}

func TestAdminAndProductSessionScopesAreIsolated(t *testing.T) {
	clock := &fakeClock{now: time.Date(2026, 8, 23, 0, 0, 0, 0, time.UTC)}
	service := New(&memoryStore{}, clock, time.Hour)
	product, err := service.IssueProductTransaction(context.Background(), ProductTransactionInput{EnterpriseID: "ent-1", ApplicationInstanceID: "ins-1", PrincipalID: "principal-1"})
	if err != nil {
		t.Fatal(err)
	}
	session, err := service.ExchangeProductTransaction(context.Background(), product.Code)
	if err != nil {
		t.Fatal(err)
	}
	if session.Kind != ProductSession || session.ApplicationInstanceID != "ins-1" || session.CookieName == AdminCookieName {
		t.Fatalf("scope leaked: %+v", session)
	}
}

func TestProductSessionRevocationIsBoundToEnterpriseAndInstance(t *testing.T) {
	clock := &fakeClock{now: time.Date(2026, 8, 23, 0, 0, 0, 0, time.UTC)}
	service := New(&memoryStore{}, clock, time.Hour)
	transaction, err := service.IssueProductTransaction(context.Background(), ProductTransactionInput{EnterpriseID: "ent-1", ApplicationInstanceID: "ins-1", PrincipalID: "principal-1"})
	if err != nil {
		t.Fatal(err)
	}
	productSession, err := service.ExchangeProductTransaction(context.Background(), transaction.Code)
	if err != nil {
		t.Fatal(err)
	}
	if err := service.RevokeProductSession(context.Background(), "ent-1", "ins-2", productSession.Token); err == nil {
		t.Fatal("cross-instance revocation should not find the session")
	}
	if err := service.RevokeProductSession(context.Background(), "ent-1", "ins-1", productSession.Token); err != nil {
		t.Fatal(err)
	}
	_, err = service.Resolve(context.Background(), productSession.Token, ProductSession)
	assertReason(t, err, "session_invalid")
}

func assertReason(t *testing.T, err error, reason string) {
	t.Helper()
	if err == nil || !strings.Contains(err.Error(), reason) {
		t.Fatalf("expected %q, got %v", reason, err)
	}
}
