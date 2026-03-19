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

	// Wails Events
	EventConnectionChanged = "connection:changed"
	EventQueryStarted      = "query:started"
	EventQueryChunk        = "query:chunk"
	EventQueryDone         = "query:done"
	EventTransactionStatus = "transaction:status"
	EventSchemaDatabases   = "schema:databases"
	EventSchemaError       = "schema:error"
	EventSchemaLoaded      = "schema:loaded"
	EventAppBeforeClose    = "app:before-close"

	// Transaction Statuses
	TransactionStatusNone   = "none"
	TransactionStatusActive = "active"
	TransactionStatusError  = "error"
)
