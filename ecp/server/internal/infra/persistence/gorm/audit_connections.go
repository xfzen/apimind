package persistence

import "gorm.io/gorm"

type AuditConnections struct{ BusinessDB, AuditIngestDB, AuditReadDB *gorm.DB }

func NewAuditConnections(business, ingest, read *gorm.DB) AuditConnections {
	return AuditConnections{BusinessDB: business, AuditIngestDB: ingest, AuditReadDB: read}
}
func (c AuditConnections) Valid() bool {
	return c.BusinessDB != nil && c.AuditIngestDB != nil && c.AuditReadDB != nil && c.BusinessDB != c.AuditIngestDB && c.BusinessDB != c.AuditReadDB && c.AuditIngestDB != c.AuditReadDB
}
