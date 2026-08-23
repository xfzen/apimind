package domain

type Principal struct {
	Base
	OriginApplicationID string `gorm:"column:origin_application_id;type:varchar(36);not null"`
	Issuer              string `gorm:"column:issuer;type:varchar(512);not null"`
	Subject             string `gorm:"column:subject;type:varchar(255);not null"`
	NormalizedEmail     string `gorm:"column:normalized_email;type:varchar(320);not null"`
	DisplayName         string `gorm:"column:display_name;type:varchar(255);not null"`
	Status              string `gorm:"column:status;type:varchar(32);not null"`
	Version             uint64 `gorm:"column:version;not null"`
}

func (Principal) TableName() string { return "principals" }
