package config

type AuditConfig struct {
	Enabled              bool   `json:",default=false"`
	BusinessDSNReference string `json:",optional"`
	IngestDSNReference   string `json:",optional"`
	ReadDSNReference     string `json:",optional"`
}
