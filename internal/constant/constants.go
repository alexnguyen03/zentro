package constant

const (
	// Tab Types
	TabTypeQuery     = "query"
	TabTypeTable     = "table"
	TabTypeSettings  = "settings"
	TabTypeShortcuts = "shortcuts"

	// Drivers
	DriverPostgres  = "postgres"
	DriverSQLServer = "sqlserver"
	DriverMySQL     = "mysql"
	DriverSQLite    = "sqlite"

	// Connection Statuses
	StatusConnected    = "connected"
	StatusDisconnected = "disconnected"
	StatusConnecting   = "connecting"
	StatusError        = "error"

	// Transaction Statuses
	TransactionStatusNone   = "none"
	TransactionStatusActive = "active"
	TransactionStatusError  = "error"
)
