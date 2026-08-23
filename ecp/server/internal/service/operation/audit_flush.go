package operation

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"time"

	"github.com/xfzen/ecp/server/internal/domain"
)

type OffboardingInstanceSource interface {
	GetInstance(context.Context, string, string) (domain.ApplicationInstance, bool, error)
}
type OffboardingDelegationSigner interface {
	IssueDelegation(context.Context, domain.Delegation) (domain.SignedDelegation, error)
}
type AuditFlushClient interface {
	FlushProductAudit(context.Context, domain.SignedDelegation) error
}
type AuditFlushClientResolver interface {
	ResolveOffboardingClient(context.Context, domain.ApplicationInstance) (AuditFlushClient, error)
}

type ProductAuditFlusher struct {
	instances OffboardingInstanceSource
	signer    OffboardingDelegationSigner
	clients   AuditFlushClientResolver
	now       func() time.Time
}

func NewProductAuditFlusher(instances OffboardingInstanceSource, signer OffboardingDelegationSigner, clients AuditFlushClientResolver) *ProductAuditFlusher {
	return &ProductAuditFlusher{instances: instances, signer: signer, clients: clients, now: time.Now}
}

func (f *ProductAuditFlusher) FlushProductAudit(ctx context.Context, enterpriseID, instanceID string) error {
	if f == nil || f.instances == nil || f.signer == nil || f.clients == nil {
		return fmt.Errorf("audit_flush_unavailable")
	}
	instance, found, err := f.instances.GetInstance(ctx, enterpriseID, instanceID)
	if err != nil {
		return err
	}
	if !found || instance.EnterpriseID != enterpriseID || instance.Status != "offboarding" {
		return fmt.Errorf("offboarding_instance_not_found")
	}
	client, err := f.clients.ResolveOffboardingClient(ctx, instance)
	if err != nil {
		return err
	}
	now := f.now().UTC()
	actor := "ecp-offboard"
	signed, err := f.signer.IssueDelegation(ctx, domain.Delegation{
		Audience: instance.ID, Subject: actor, EnterpriseID: enterpriseID, ApplicationID: instance.ApplicationID, InstanceID: instance.ID,
		ResourceType: "instance", ResourceID: instance.ID, Actions: []string{"audit.flush"}, ActorPrincipalID: actor,
		RequestedAction: "audit.flush", Purpose: domain.DelegationPurposeProduct, OperationID: opaqueOperationID(), Nonce: opaqueOperationID(),
		IssuedAt: now, ExpiresAt: now.Add(30 * time.Second),
	})
	if err != nil {
		return err
	}
	return client.FlushProductAudit(ctx, signed)
}

func opaqueOperationID() string {
	value := make([]byte, 16)
	if _, err := rand.Read(value); err != nil {
		panic(err)
	}
	return hex.EncodeToString(value)
}
