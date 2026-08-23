package session

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"time"

	"github.com/xfzen/ecp/server/internal/domain"
)

const (
	AdminSession      = domain.SessionKindAdmin
	ProductSession    = domain.SessionKindProduct
	AdminCookieName   = "ecp_admin_session"
	ProductCookieName = "ecp_product_session"
)

type Clock interface{ Now() time.Time }
type systemClock struct{}

func (systemClock) Now() time.Time { return time.Now().UTC() }

type Store interface {
	CreateLoginTransaction(context.Context, domain.LoginTransaction) error
	GetLoginTransaction(context.Context, string) (domain.LoginTransaction, bool, error)
	MarkLoginTransactionUsed(context.Context, string, time.Time) (bool, error)
	CreateProductTransaction(context.Context, domain.ProductLoginTransaction) error
	ConsumeProductTransaction(context.Context, string, time.Time) (domain.ProductLoginTransaction, bool, error)
	CreateSession(context.Context, domain.Session) error
	GetSessionByTokenHash(context.Context, string) (domain.Session, bool, error)
	ListSessions(context.Context, string) ([]domain.Session, error)
	RevokeSession(context.Context, string, string, time.Time) (bool, error)
	RevokePrincipalSessions(context.Context, string, string, time.Time) (int64, error)
}

type OIDCClaims = domain.VerifiedOIDCClaims
type OIDCVerifier interface {
	Verify(context.Context, string, string, string) (domain.VerifiedOIDCClaims, error)
}
type PrincipalResolver interface {
	ResolvePrincipal(context.Context, string, string, string) (string, error)
}

type Service struct {
	store    Store
	clock    Clock
	ttl      time.Duration
	verifier OIDCVerifier
	resolver PrincipalResolver
}

func New(store Store, clock Clock, ttl time.Duration) *Service {
	return NewWithVerifier(store, clock, ttl, nil)
}
func NewWithVerifier(store Store, clock Clock, ttl time.Duration, verifier OIDCVerifier) *Service {
	return NewWithSecurity(store, clock, ttl, verifier, nil)
}
func NewWithSecurity(store Store, clock Clock, ttl time.Duration, verifier OIDCVerifier, resolver PrincipalResolver) *Service {
	if clock == nil {
		clock = systemClock{}
	}
	if ttl <= 0 {
		ttl = 8 * time.Hour
	}
	return &Service{store: store, clock: clock, ttl: ttl, verifier: verifier, resolver: resolver}
}

type DecisionError struct {
	Reason string
	Err    error
}

func (e *DecisionError) Error() string {
	if e.Err == nil {
		return e.Reason
	}
	return fmt.Sprintf("%s: %v", e.Reason, e.Err)
}
func (e *DecisionError) Unwrap() error { return e.Err }

type BeginInput struct{ EnterpriseID, OIDCClientID, ApplicationInstanceID, Kind, RedirectURI string }
type BeginResult struct {
	TransactionID, State, PKCEVerifier, Nonce string
	ExpiresAt                                 time.Time
}

func (s *Service) Begin(ctx context.Context, input BeginInput) (BeginResult, error) {
	if s == nil || s.store == nil || input.EnterpriseID == "" || input.OIDCClientID == "" || input.RedirectURI == "" || (input.Kind != AdminSession && input.Kind != ProductSession) {
		return BeginResult{}, decision("login_transaction_invalid", nil)
	}
	if input.Kind == ProductSession && input.ApplicationInstanceID == "" {
		return BeginResult{}, decision("login_transaction_invalid", nil)
	}
	state, verifier, nonce := randomToken(32), randomToken(32), randomToken(32)
	now := s.clock.Now().UTC()
	expires := now.Add(10 * time.Minute)
	value := domain.LoginTransaction{Base: domain.Base{ID: newID("ltx"), EnterpriseID: input.EnterpriseID, CreatedAt: now, UpdatedAt: now}, OIDCClientID: input.OIDCClientID, ApplicationInstanceID: input.ApplicationInstanceID, Kind: input.Kind, StateHash: hash(state), PKCEVerifierHash: hash(verifier), NonceHash: hash(nonce), RedirectURI: input.RedirectURI, ExpiresAt: expires}
	if err := s.store.CreateLoginTransaction(ctx, value); err != nil {
		return BeginResult{}, decision("session_store_error", err)
	}
	return BeginResult{TransactionID: value.ID, State: state, PKCEVerifier: verifier, Nonce: nonce, ExpiresAt: expires}, nil
}

type CompleteInput struct{ TransactionID, State, PKCEVerifier, Nonce, Code, ExpectedAudience string }

func (s *Service) Complete(ctx context.Context, input CompleteInput) (domain.Session, error) {
	if s == nil || s.store == nil {
		return domain.Session{}, decision("session_unavailable", nil)
	}
	transaction, found, err := s.store.GetLoginTransaction(ctx, input.TransactionID)
	if err != nil {
		return domain.Session{}, decision("session_store_error", err)
	}
	if !found {
		return domain.Session{}, decision("login_transaction_not_found", nil)
	}
	if transaction.UsedAt != nil {
		return domain.Session{}, decision("login_transaction_used", nil)
	}
	if s.clock.Now().After(transaction.ExpiresAt) {
		return domain.Session{}, decision("login_transaction_expired", nil)
	}
	if !hashEqual(transaction.StateHash, input.State) {
		return domain.Session{}, decision("oidc_state_mismatch", nil)
	}
	if !hashEqual(transaction.PKCEVerifierHash, input.PKCEVerifier) {
		return domain.Session{}, decision("oidc_pkce_mismatch", nil)
	}
	if !hashEqual(transaction.NonceHash, input.Nonce) {
		return domain.Session{}, decision("oidc_nonce_mismatch", nil)
	}
	if s.verifier == nil {
		return domain.Session{}, decision("oidc_verifier_unavailable", nil)
	}
	used, err := s.store.MarkLoginTransactionUsed(ctx, transaction.ID, s.clock.Now().UTC())
	if err != nil {
		return domain.Session{}, decision("session_store_error", err)
	}
	if !used {
		return domain.Session{}, decision("login_transaction_used", nil)
	}
	claims, err := s.verifier.Verify(ctx, input.Code, input.PKCEVerifier, transaction.RedirectURI)
	if err != nil {
		return domain.Session{}, decision("oidc_exchange_failed", err)
	}
	if claims.Nonce != input.Nonce {
		return domain.Session{}, decision("oidc_nonce_mismatch", nil)
	}
	if input.ExpectedAudience == "" || claims.Audience != input.ExpectedAudience {
		return domain.Session{}, decision("oidc_audience_mismatch", nil)
	}
	principalID := claims.PrincipalID
	if principalID == "" {
		if s.resolver == nil {
			return domain.Session{}, decision("identity_resolver_unavailable", nil)
		}
		principalID, err = s.resolver.ResolvePrincipal(ctx, transaction.EnterpriseID, claims.Issuer, claims.Subject)
		if err != nil {
			return domain.Session{}, decision("identity_resolution_failed", err)
		}
	}
	return s.issueSession(ctx, transaction.EnterpriseID, transaction.ApplicationInstanceID, principalID, transaction.Kind)
}

type ProductTransactionInput struct{ EnterpriseID, ApplicationInstanceID, PrincipalID string }
type ProductTransactionResult struct {
	ID, Code  string
	ExpiresAt time.Time
}

func (s *Service) IssueProductTransaction(ctx context.Context, input ProductTransactionInput) (ProductTransactionResult, error) {
	if s == nil || s.store == nil || input.EnterpriseID == "" || input.ApplicationInstanceID == "" || input.PrincipalID == "" {
		return ProductTransactionResult{}, decision("login_transaction_invalid", nil)
	}
	code := randomToken(32)
	now := s.clock.Now().UTC()
	expires := now.Add(2 * time.Minute)
	value := domain.ProductLoginTransaction{Base: domain.Base{ID: newID("ptx"), EnterpriseID: input.EnterpriseID, CreatedAt: now, UpdatedAt: now}, ApplicationInstanceID: input.ApplicationInstanceID, PrincipalID: input.PrincipalID, CodeHash: hash(code), ExpiresAt: expires}
	if err := s.store.CreateProductTransaction(ctx, value); err != nil {
		return ProductTransactionResult{}, decision("session_store_error", err)
	}
	return ProductTransactionResult{ID: value.ID, Code: code, ExpiresAt: expires}, nil
}

func (s *Service) ExchangeProductTransaction(ctx context.Context, code string) (domain.Session, error) {
	if s == nil || s.store == nil || code == "" {
		return domain.Session{}, decision("login_transaction_invalid", nil)
	}
	now := s.clock.Now().UTC()
	value, consumed, err := s.store.ConsumeProductTransaction(ctx, hash(code), now)
	if err != nil {
		return domain.Session{}, decision("session_store_error", err)
	}
	if !consumed {
		return domain.Session{}, decision("login_transaction_used", nil)
	}
	if now.After(value.ExpiresAt) {
		return domain.Session{}, decision("login_transaction_expired", nil)
	}
	return s.issueSession(ctx, value.EnterpriseID, value.ApplicationInstanceID, value.PrincipalID, ProductSession)
}

func (s *Service) issueSession(ctx context.Context, enterpriseID, instanceID, principalID, kind string) (domain.Session, error) {
	token, csrf := randomToken(32), randomToken(32)
	now := s.clock.Now().UTC()
	value := domain.Session{Base: domain.Base{ID: newID("ses"), EnterpriseID: enterpriseID, CreatedAt: now, UpdatedAt: now}, PrincipalID: principalID, ApplicationInstanceID: instanceID, Kind: kind, TokenHash: hash(token), CSRFHash: hash(csrf), ExpiresAt: now.Add(s.ttl), Version: 1, Token: token, CSRFToken: csrf}
	if kind == AdminSession {
		value.CookieName = AdminCookieName
	} else {
		value.CookieName = ProductCookieName
	}
	if err := s.store.CreateSession(ctx, value); err != nil {
		return domain.Session{}, decision("session_store_error", err)
	}
	return value, nil
}

func (s *Service) Resolve(ctx context.Context, token, requiredKind string) (domain.Session, error) {
	value, found, err := s.store.GetSessionByTokenHash(ctx, hash(token))
	if err != nil {
		return domain.Session{}, decision("session_store_error", err)
	}
	if !found || value.RevokedAt != nil || s.clock.Now().After(value.ExpiresAt) || value.Kind != requiredKind {
		return domain.Session{}, decision("session_invalid", nil)
	}
	return value, nil
}
func (s *Service) List(ctx context.Context, enterpriseID string) ([]domain.Session, error) {
	return s.store.ListSessions(ctx, enterpriseID)
}
func (s *Service) Revoke(ctx context.Context, enterpriseID, id string) error {
	ok, err := s.store.RevokeSession(ctx, enterpriseID, id, s.clock.Now().UTC())
	if err != nil {
		return decision("session_store_error", err)
	}
	if !ok {
		return decision("session_not_found", nil)
	}
	return nil
}
func (s *Service) RevokePrincipal(ctx context.Context, enterpriseID, principalID string) (int64, error) {
	count, err := s.store.RevokePrincipalSessions(ctx, enterpriseID, principalID, s.clock.Now().UTC())
	if err != nil {
		return 0, decision("session_store_error", err)
	}
	return count, nil
}

func HashToken(value string) string { return hash(value) }
func PKCEChallenge(verifier string) string {
	digest := sha256.Sum256([]byte(verifier))
	return base64.RawURLEncoding.EncodeToString(digest[:])
}
func hash(value string) string {
	digest := sha256.Sum256([]byte(value))
	return hex.EncodeToString(digest[:])
}
func hashEqual(expected, raw string) bool {
	actual := hash(raw)
	return subtle.ConstantTimeCompare([]byte(expected), []byte(actual)) == 1
}
func randomToken(size int) string {
	value := make([]byte, size)
	if _, err := rand.Read(value); err != nil {
		panic(err)
	}
	return hex.EncodeToString(value)
}
func newID(prefix string) string              { return prefix + "_" + randomToken(16) }
func decision(reason string, err error) error { return &DecisionError{Reason: reason, Err: err} }
