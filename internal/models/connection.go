package models

import "zentro/internal/constant"

// ConnectionProfile lưu thông tin kết nối đến một database.
// Password được base64-encoded khi lưu vào Preferences.
type ConnectionProfile struct {
	Name            string `json:"name"`               // required, unique, max 50
	Driver          string `json:"driver"`             // "postgres" | "sqlserver"
	Host            string `json:"host"`               // default "localhost"
	Port            int    `json:"port"`               // 5432 (pg) | 1433 (mssql)
	DBName          string `json:"db_name"`            // required
	Username        string `json:"username"`           // required
	Password        string `json:"password"`           // base64-encoded khi SavePassword=true
	SSLMode         string `json:"ssl_mode,omitempty"` // postgres only: "disable" | "require"
	ConnectTimeout  int    `json:"connect_timeout"`    // giây, default 30
	SavePassword    bool   `json:"save_password"`
	ShowAllSchemas  bool   `json:"show_all_schemas"`
	TrustServerCert bool   `json:"trust_server_cert"`
}

// NewConnectionProfile trả về một profile mới với default values.
func NewConnectionProfile() *ConnectionProfile {
	return &ConnectionProfile{
		Host:            "localhost",
		Port:            5432,
		Driver:          constant.DriverPostgres,
		SSLMode:         "disable",
		ConnectTimeout:  30,
		SavePassword:    true,
		ShowAllSchemas:  false,
		TrustServerCert: false,
	}
}
