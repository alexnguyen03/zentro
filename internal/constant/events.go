package constant

const (
	EventConnectionChanged = "connection:changed"
	EventQueryStarted      = "query:started"
	EventQueryChunk        = "query:chunk"
	EventQueryDone         = "query:done"
	EventQueryRowCount     = "query:row_count"
	EventTransactionStatus = "transaction:status"
	EventSchemaDatabases   = "schema:databases"
	EventSchemaError       = "schema:error"
	EventSchemaLoaded      = "schema:loaded"
	EventAppBeforeClose    = "app:before-close"
)

const (
	EventConnectionChangedV2 = "connection:changed.v2"
	EventQueryStartedV2      = "query:started.v2"
	EventQueryChunkV2        = "query:chunk.v2"
	EventQueryDoneV2         = "query:done.v2"
	EventQueryRowCountV2     = "query:row_count.v2"
	EventTransactionStatusV2 = "transaction:status.v2"
	EventSchemaDatabasesV2   = "schema:databases.v2"
	EventSchemaErrorV2       = "schema:error.v2"
	EventSchemaLoadedV2      = "schema:loaded.v2"
)
