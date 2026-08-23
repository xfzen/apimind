package domain

type Enterprise struct {
	Base
	Name   string `gorm:"column:name;type:varchar(128);not null"`
	Status string `gorm:"column:status;type:varchar(32);not null"`
}

func (Enterprise) TableName() string { return "enterprises" }
