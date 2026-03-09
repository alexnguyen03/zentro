---
description: SOLID refactor + multi-DB extension workflow for Zentro backend
---

# SOLID Refactor + Multi-DB Extension

// turbo-all

Read the implementation plan artifact first before doing anything:
`C:\Users\IT_NAM\.gemini\antigravity\brain\4234ece2-a6f8-4a1e-be28-53589799e52a\implementation_plan.md`

Also read the task checklist:
`C:\Users\IT_NAM\.gemini\antigravity\brain\4234ece2-a6f8-4a1e-be28-53589799e52a\task.md`

---

## Pre-conditions

Before starting, read these key source files so you have full context:
- `d:\coding\personal\zentro\internal\app\app.go` (entire file — 978 lines)
- `d:\coding\personal\zentro\internal\driver\driver.go`
- `d:\coding\personal\zentro\internal\db\executor.go`
- `d:\coding\personal\zentro\internal\models\query.go`
- `d:\coding\personal\zentro\internal\core\registry.go`
- `d:\coding\personal\zentro\internal\driver\postgres\postgres.go`
- `d:\coding\personal\zentro\internal\driver\mssql\mssql.go`
- `d:\coding\personal\zentro\main.go`

---

## Step 1 — Fix models/query.go: merge HistoryEntry

Merge the `HistoryEntry` in `app.go` into `models/query.go`. The canonical struct should have:
```go
type HistoryEntry struct {
    ID         string `json:"id"`
    Query      string `json:"query"`
    Profile    string `json:"profile"`
    Database   string `json:"database"`
    DurationMs int64  `json:"duration_ms"`
    RowCount   int64  `json:"row_count"`
    Error      string `json:"error,omitempty"`
    ExecutedAt string `json:"executed_at"`
}
```
Remove the old `HistoryEntry` definition from `app.go`.

## Step 2 — Add QueryDialect to driver interface

In `internal/driver/driver.go`, add the `QueryDialect` interface and embed it in `DatabaseDriver`:

```go
// QueryDialect is the Port for SQL dialect differences (pagination, schema defaults).
type QueryDialect interface {
    InjectPageClause(query string, limit, offset int) string
    DefaultSchema() string
}

// DatabaseDriver is the full extension point: Connector + SchemaFetcher + QueryDialect.
type DatabaseDriver interface {
    Connector
    SchemaFetcher
    QueryDialect
}
```

## Step 3 — Implement QueryDialect in postgres driver

In `internal/driver/postgres/postgres.go`, add:
```go
func (d *PostgresDriver) DefaultSchema() string { return "public" }

func (d *PostgresDriver) InjectPageClause(query string, limit, offset int) string {
    // Use the same limitPattern logic already in executor.go
    // If query already has LIMIT/OFFSET/TOP/FETCH: return unchanged
    // Otherwise: append LIMIT x OFFSET y (or just LIMIT x if offset == 0)
}
```

## Step 4 — Implement QueryDialect in mssql driver

Read `internal/driver/mssql/mssql.go` first, then add:
```go
func (d *MssqlDriver) DefaultSchema() string { return "dbo" }

func (d *MssqlDriver) InjectPageClause(query string, limit, offset int) string {
    // Same guard: if query has LIMIT/OFFSET/TOP/FETCH: return unchanged
    // Add ORDER BY 1 if no ORDER BY present
    // Append: OFFSET x ROWS FETCH NEXT y ROWS ONLY
}
```

## Step 5 — Create MySQL driver stub

Create `internal/driver/mysql/mysql.go`:
- Driver name: `"mysql"`
- `Open`: use `database/sql` with driver `"mysql"` (go-sql-driver/mysql DSN format: `user:pass@tcp(host:port)/dbname`)
- `FriendlyError`: map common MySQL errors (access denied, connection refused, unknown database)
- `FetchDatabases`: query `SHOW DATABASES` or `information_schema.SCHEMATA`
- `FetchSchema`: query `information_schema.TABLES` filtered by `TABLE_SCHEMA`
- `FetchTablePrimaryKeys`: query `information_schema.KEY_COLUMN_USAGE` where `CONSTRAINT_NAME = 'PRIMARY'`
- `DefaultSchema() string`: return `""` (MySQL schema = database name, passed in profile.DBName)
- `InjectPageClause`: `LIMIT x OFFSET y`

## Step 6 — Create SQLite driver stub

Create `internal/driver/sqlite/sqlite.go`:
- Driver name: `"sqlite"`
- `Open`: `sql.Open("sqlite", p.DBName)` where DBName is the file path or `:memory:`
- `FriendlyError`: pass-through
- `FetchDatabases`: return single `DatabaseInfo{Name: p.DBName}`
- `FetchSchema`: `SELECT name, type FROM sqlite_master WHERE type IN ('table','view') ORDER BY name`
- `FetchTablePrimaryKeys`: `PRAGMA table_info(tablename)` — filter where `pk > 0`
- `DefaultSchema() string`: return `"main"`
- `InjectPageClause`: `LIMIT x OFFSET y`

## Step 7 — Refactor executor.go

Replace the driver-branching in `InjectLimitOffsetIfMissing` with delegation:

```go
// InjectPageClause delegates pagination generation to the registered driver.
func InjectPageClause(driverName, query string, limit, offset int) string {
    d, ok := core.Get(driverName)
    if !ok {
        return fallbackInjectPage(query, limit, offset)
    }
    return d.InjectPageClause(query, limit, offset)
}

// fallbackInjectPage: LIMIT x OFFSET y for unknown drivers
func fallbackInjectPage(query string, limit, offset int) string { ... }
```

Keep `IsSelectQuery` and `ExtractTableFromQuery` as-is. Keep `limitPattern` regex (needed for the guard inside each driver's `InjectPageClause`).

Update all callers in `app.go` from `dbpkg.InjectLimitOffsetIfMissing(query, driver, ...)` to `dbpkg.InjectPageClause(driver, query, ...)`.

## Step 8 — Fix hardcoded driver strings in app.go streamSelect

Replace:
```go
if driver == "postgres" { trySchemas = []string{"public"} }
else if driver == "sqlserver" { trySchemas = []string{"dbo"} }
```

With:
```go
d, ok := core.Get(driver)
if ok && d.DefaultSchema() != "" {
    trySchemas = []string{d.DefaultSchema()}
} else {
    trySchemas = []string{""}
}
```

## Step 9 — Decompose app.go into services

### 9A. Create internal/app/history_service.go
Extract all history logic from `app.go`:
```go
type HistoryService struct {
    mu      sync.Mutex
    entries []models.HistoryEntry
    getProfile func() *models.ConnectionProfile
}
```
Methods: `GetHistory`, `ClearHistory`, `AppendEntry`, `saveHistoryFile`, `loadHistoryFile`, `historyFilePath`.

### 9B. Create internal/app/script_service.go
```go
type ScriptService struct {
    logger *slog.Logger
}
```
Methods: `GetScripts`, `GetScriptContent`, `SaveScript`, `DeleteScript` — each delegates to the corresponding `utils.*` function.

### 9C. Create internal/app/connection_service.go
```go
type ConnectionService struct {
    ctx        context.Context
    logger     *slog.Logger
    getPrefs   func() utils.Preferences
    setDB      func(*sql.DB, *models.ConnectionProfile) // callback to update App state
    getDB      func() *sql.DB
    getProfile func() *models.ConnectionProfile
}
```
Methods: `Connect`, `Disconnect`, `SwitchDatabase`, `TestConnection`, `SaveConnection`, `DeleteConnection`, `LoadConnections`, `fetchDatabaseList`.

### 9D. Create internal/app/query_service.go
```go
type QueryService struct {
    ctx           context.Context
    logger        *slog.Logger
    getPrefs      func() utils.Preferences
    getDB         func() *sql.DB
    getDriver     func() string
    appendHistory func(query string, rowCount int64, dur time.Duration, err error)
    sessions      map[string]*QuerySession
    sessionsMu    sync.Mutex
    activeQueries   map[string]string
    activeQueriesMu sync.RWMutex
}
```
Methods: `ExecuteQuery`, `FetchMoreRows`, `CancelQuery`, `FetchTotalRowCount`, `ExecuteUpdateSync`, all internal helpers.

### 9E. Update app.go to wire services
`App` struct becomes thin:
```go
type App struct {
    ctx       context.Context
    logger    *slog.Logger
    db        *sql.DB
    profile   *models.ConnectionProfile
    prefs     utils.Preferences
    forceQuit bool

    conn    *ConnectionService
    query   *QueryService
    history *HistoryService
    scripts *ScriptService
}
```
All exported methods become 1-liner delegates.
`NewApp()` wires all services using callbacks.

## Step 10 — Update main.go driver registrations

In `main.go` (or wherever `core.Register` calls are), add:
```go
core.Register(mysql.New())
core.Register(sqlite.New())
```

## Step 11 — Update go.mod if needed

MySQL driver: `github.com/go-sql-driver/mysql`
SQLite driver: `modernc.org/sqlite` (already in go.mod from tests)

Run:
```powershell
cd d:\coding\personal\zentro
go mod tidy
```

## Step 12 — Verify: run tests

```powershell
cd d:\coding\personal\zentro
go test ./internal/... -v
```

All existing tests must pass. Fix any compilation errors due to the interface changes.

## Step 13 — Build check

```powershell
cd d:\coding\personal\zentro
go build ./...
```

Must compile with zero errors.
