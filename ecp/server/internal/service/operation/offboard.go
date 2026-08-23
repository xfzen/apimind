package operation

import (
	"context"
	"fmt"
)

type AuditFlusher interface {
	FlushProductAudit(context.Context, string, string) error
}

type OffboardStore interface {
	BeginOffboarding(context.Context, string, string) (string, error)
	RevokeProductSessions(context.Context, string, string) (int64, error)
	RevokeInstanceCredentials(context.Context, string, string) (int64, error)
	FinalLifecycleVersion(context.Context, string) (uint64, error)
	DisableConnector(context.Context, string, string) error
}

type OffboardResult struct {
	Export                PortableExport
	ExportVerified        bool
	SessionsRevoked       bool
	CredentialsRevoked    bool
	AuditFlushed          bool
	ConnectorDisabled     bool
	FinalLifecycleVersion uint64
}

func (s *Service) OffboardInstance(ctx context.Context, enterpriseID, instanceID string) (OffboardResult, error) {
	if s == nil || s.offboard == nil || s.flush == nil {
		return OffboardResult{}, fmt.Errorf("offboard_unavailable")
	}
	exported, err := s.ExportInstance(ctx, enterpriseID, instanceID)
	if err != nil {
		return OffboardResult{}, err
	}
	result := OffboardResult{Export: exported, ExportVerified: VerifyExport(exported)}
	if !result.ExportVerified {
		return result, fmt.Errorf("offboard_export_verification_failed")
	}
	state, err := s.offboard.BeginOffboarding(ctx, enterpriseID, instanceID)
	if err != nil {
		return result, err
	}
	if state == "disabled" {
		result.SessionsRevoked = true
		result.CredentialsRevoked = true
		result.AuditFlushed = true
		result.ConnectorDisabled = true
		result.FinalLifecycleVersion, err = s.offboard.FinalLifecycleVersion(ctx, enterpriseID)
		return result, err
	}
	if _, err := s.offboard.RevokeProductSessions(ctx, enterpriseID, instanceID); err != nil {
		return result, err
	}
	result.SessionsRevoked = true
	if _, err := s.offboard.RevokeInstanceCredentials(ctx, enterpriseID, instanceID); err != nil {
		return result, err
	}
	result.CredentialsRevoked = true
	if err := s.flush.FlushProductAudit(ctx, enterpriseID, instanceID); err != nil {
		return result, err
	}
	result.AuditFlushed = true
	result.FinalLifecycleVersion, err = s.offboard.FinalLifecycleVersion(ctx, enterpriseID)
	if err != nil {
		return result, err
	}
	if err := s.offboard.DisableConnector(ctx, enterpriseID, instanceID); err != nil {
		return result, err
	}
	result.ConnectorDisabled = true
	return result, nil
}
