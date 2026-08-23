package adminWrite

import (
	"context"
	"fmt"

	apiMiddleware "github.com/xfzen/ecp/server/api/internal/middleware"
	auditservice "github.com/xfzen/ecp/server/internal/service/audit"
)

func runAuditedMutation(ctx context.Context, service *auditservice.Service, operation auditservice.Operation, mutation func() error) error {
	if mutation == nil {
		return fmt.Errorf("mutation_required")
	}
	if service == nil {
		return mutation()
	}
	operationID, found := apiMiddleware.OperationIDFromContext(ctx)
	if !found {
		return fmt.Errorf("operation_id_required")
	}
	operation.ID = operationID
	if err := service.Intent(ctx, operation); err != nil {
		return err
	}
	if err := mutation(); err != nil {
		if auditErr := service.Outcome(ctx, operation, "failed", "mutation_failed"); auditErr != nil {
			return fmt.Errorf("mutation failed: %w; audit outcome failed: %v", err, auditErr)
		}
		return err
	}
	return service.Outcome(ctx, operation, "succeeded", "")
}
