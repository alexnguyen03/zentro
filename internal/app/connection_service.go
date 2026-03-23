package app

import (
	"context"
	"database/sql"
	"fmt"
	"log/slog"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"

	"zentro/internal/constant"
	dbpkg "zentro/internal/db"
	"zentro/internal/models"
	"zentro/internal/utils"
)

type ConnectionService struct {
	ctx              context.Context
	logger           *slog.Logger
	getPrefs         func() utils.Preferences
	getDB            func() *sql.DB
	getProfile       func() *models.ConnectionProfile
	rollbackActiveTx func() error
	setDB            func(*sql.DB, *models.ConnectionProfile)
	keepAliveCancel  context.CancelFunc
	emitter          EventEmitter
}

func NewConnectionService(
	ctx context.Context, logger *slog.Logger, getPrefs func() utils.Preferences,
	getDB func() *sql.DB, getProfile func() *models.ConnectionProfile,
	rollbackActiveTx func() error,
	setDB func(*sql.DB, *models.ConnectionProfile),
	emitter EventEmitter,
) *ConnectionService {
	return &ConnectionService{
		ctx:              ctx,
		logger:           logger,
		getPrefs:         getPrefs,
		getDB:            getDB,
		getProfile:       getProfile,
		rollbackActiveTx: rollbackActiveTx,
		setDB:            setDB,
		emitter:          emitter,
	}
}

// Ensure context is up-to-date
func (s *ConnectionService) SetContext(ctx context.Context) {
	s.ctx = ctx
}

func (s *ConnectionService) LoadConnections() ([]*models.ConnectionProfile, error) {
	return utils.LoadConnections()
}

func (s *ConnectionService) LoadDatabasesForProfile(name string) ([]string, error) {
	profiles, err := utils.LoadConnections()
	if err != nil {
		return nil, err
	}

	var prof *models.ConnectionProfile
	for _, p := range profiles {
		if p.Name == name {
			prof = p
			break
		}
	}
	if prof == nil {
		return nil, fmt.Errorf("connection %q not found", name)
	}

	db, err := dbpkg.OpenConnection(prof)
	if err != nil {
		return nil, dbpkg.FriendlyError(prof.Driver, err)
	}
	defer db.Close()

	prefs := s.getPrefs()
	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(prefs.ConnectTimeout)*time.Second)
	defer cancel()
	if err := db.PingContext(ctx); err != nil {
		return nil, dbpkg.FriendlyError(prof.Driver, err)
	}

	dbs, err := dbpkg.FetchDatabases(db, prof.Driver, prof.DBName, prof.ShowAllSchemas, s.logger)
	if err != nil {
		return nil, err
	}

	names := make([]string, 0, len(dbs)+1)
	seen := make(map[string]bool)
	if prof.DBName != "" {
		names = append(names, prof.DBName)
		seen[prof.DBName] = true
	}
	for _, d := range dbs {
		if d.Name == "" || seen[d.Name] {
			continue
		}
		names = append(names, d.Name)
		seen[d.Name] = true
	}

	return names, nil
}

func (s *ConnectionService) SaveConnection(p models.ConnectionProfile) error {
	if p.SavePassword && !p.EncryptPassword {
		p.EncryptPassword = true
	}
	profiles, err := utils.LoadConnections()
	if err != nil {
		return err
	}
	found := false
	for i, existing := range profiles {
		if existing.Name == p.Name {
			profiles[i] = &p
			found = true
			break
		}
	}
	if !found {
		profiles = append(profiles, &p)
	}
	s.logger.Info("saving connection", "profile", p.Name)
	return utils.SaveConnections(profiles)
}

func (s *ConnectionService) DeleteConnection(name string) error {
	s.logger.Info("deleting connection", "profile", name)
	return utils.DeleteConnection(name)
}

func (s *ConnectionService) TestConnection(p models.ConnectionProfile) error {
	s.logger.Info("testing connection", "profile", p.Name)
	return dbpkg.TestConnection(&p)
}

func (s *ConnectionService) Connect(name string) error {
	profiles, err := utils.LoadConnections()
	if err != nil {
		return err
	}
	var prof *models.ConnectionProfile
	for _, p := range profiles {
		if p.Name == name {
			prof = p
			break
		}
	}
	if prof == nil {
		return fmt.Errorf("connection %q not found", name)
	}

	return s.ConnectWithProfile(prof)
}

func (s *ConnectionService) Reconnect() error {
	prof := s.getProfile()
	if prof == nil {
		return fmt.Errorf("no active connection to reconnect")
	}
	s.logger.Info("reconnecting", "profile", prof.Name, "db", prof.DBName)
	return s.ConnectWithProfile(prof)
}

func (s *ConnectionService) ConnectWithProfile(prof *models.ConnectionProfile) error {
	s.logger.Info("connecting",
		"profile", prof.Name,
		"driver", prof.Driver,
		"host", prof.Host,
		"port", prof.Port,
		"db_name", prof.DBName,
		"ssl_mode", prof.SSLMode,
	)

	// Clean up previous connection regardless of success to reflect the user's intent to switch
	if s.rollbackActiveTx != nil {
		_ = s.rollbackActiveTx()
	}
	previousDB := s.getDB()
	if previousDB != nil {
		_ = previousDB.Close()
	}
	if s.keepAliveCancel != nil {
		s.keepAliveCancel()
		s.keepAliveCancel = nil
	}

	// Set active profile immediately with nil DB. If connection fails,
	// it acts as the "errored" active profile.
	s.setDB(nil, prof)

	s.emitter.Emit(s.ctx, constant.EventConnectionChanged, map[string]any{
		"profile": prof,
		"status":  constant.StatusConnecting,
	})

	db, err := dbpkg.OpenConnection(prof)
	if err != nil {
		s.logger.Error("open connection failed", "profile", prof.Name, "err", err)
		fErr := dbpkg.FriendlyError(prof.Driver, err)
		s.emitter.Emit(s.ctx, constant.EventConnectionChanged, map[string]any{
			"profile": prof,
			"status":  constant.StatusError,
		})
		return fErr
	}

	prefs := s.getPrefs()
	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(prefs.ConnectTimeout)*time.Second)
	defer cancel()
	if err := db.PingContext(ctx); err != nil {
		db.Close()
		s.logger.Error("ping failed", "profile", prof.Name, "err", err)
		fErr := dbpkg.FriendlyError(prof.Driver, err)
		s.emitter.Emit(s.ctx, constant.EventConnectionChanged, map[string]any{
			"profile": prof,
			"status":  constant.StatusError,
		})
		return fErr
	}

	// Connection successful, update store
	s.setDB(db, prof)

	kaCtx, kaCancel := context.WithCancel(context.Background())
	s.keepAliveCancel = kaCancel
	go s.startKeepAlive(kaCtx, db, prof)

	s.emitter.Emit(s.ctx, constant.EventConnectionChanged, map[string]any{
		"profile": prof,
		"status":  constant.StatusConnected,
	})
	s.logger.Info("connected — emitted connection:changed",
		"profile", prof.Name,
		"driver", prof.Driver,
		"db_name", prof.DBName,
	)
	runtime.WindowSetTitle(s.ctx, fmt.Sprintf("Zentro — %s (%s)", prof.Name, prof.Driver))

	go s.fetchDatabaseList(db, prof)
	return nil
}

func (s *ConnectionService) SwitchDatabase(dbName string) error {
	prof := s.getProfile()
	if prof == nil {
		return fmt.Errorf("no active connection")
	}
	if prof.DBName == dbName {
		return nil
	}

	s.logger.Info("switching database", "from", prof.DBName, "to", dbName)

	clone := *prof
	clone.DBName = dbName

	previousDB := s.getDB()
	if s.rollbackActiveTx != nil {
		_ = s.rollbackActiveTx()
	}
	if previousDB != nil {
		_ = previousDB.Close()
	}
	if s.keepAliveCancel != nil {
		s.keepAliveCancel()
		s.keepAliveCancel = nil
	}
	s.setDB(nil, &clone)

	s.emitter.Emit(s.ctx, constant.EventConnectionChanged, map[string]any{
		"profile": &clone,
		"status":  constant.StatusConnecting,
	})

	db, err := dbpkg.OpenConnection(&clone)
	if err != nil {
		s.logger.Error("switch database failed", "db", dbName, "err", err)
		fErr := dbpkg.FriendlyError(clone.Driver, err)
		s.emitter.Emit(s.ctx, constant.EventConnectionChanged, map[string]any{
			"profile": &clone,
			"status":  constant.StatusError,
		})
		return fErr
	}

	prefs := s.getPrefs()
	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(prefs.ConnectTimeout)*time.Second)
	defer cancel()
	if err := db.PingContext(ctx); err != nil {
		db.Close()
		s.logger.Error("ping failed on new db", "db", dbName, "err", err)
		fErr := dbpkg.FriendlyError(clone.Driver, err)
		s.emitter.Emit(s.ctx, constant.EventConnectionChanged, map[string]any{
			"profile": &clone,
			"status":  constant.StatusError,
		})
		return fErr
	}

	s.setDB(db, &clone)

	kaCtx, kaCancel := context.WithCancel(context.Background())
	s.keepAliveCancel = kaCancel
	go s.startKeepAlive(kaCtx, db, &clone)

	s.logger.Info("switched database ok")
	s.emitter.Emit(s.ctx, constant.EventConnectionChanged, map[string]any{
		"profile": &clone,
		"status":  constant.StatusConnected,
	})

	go s.fetchDatabaseList(db, &clone)
	return nil
}

func (s *ConnectionService) Disconnect() {
	if s.rollbackActiveTx != nil {
		_ = s.rollbackActiveTx()
	}
	if s.keepAliveCancel != nil {
		s.keepAliveCancel()
		s.keepAliveCancel = nil
	}
	db := s.getDB()
	if db != nil {
		_ = db.Close()
	}
	s.setDB(nil, nil)
	s.emitter.Emit(s.ctx, constant.EventConnectionChanged, map[string]any{"status": constant.StatusDisconnected})
	runtime.WindowSetTitle(s.ctx, "Zentro")
	s.logger.Info("disconnected")
}

func (s *ConnectionService) GetConnectionStatus() (map[string]any, error) {
	prof := s.getProfile()
	db := s.getDB()
	status := constant.StatusDisconnected
	if db != nil {
		status = constant.StatusConnected
	}
	return map[string]any{
		"profile": prof,
		"status":  status,
	}, nil
}

func (s *ConnectionService) startKeepAlive(ctx context.Context, db *sql.DB, prof *models.ConnectionProfile) {
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()

	currentState := constant.StatusConnected

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			// Run ping in a goroutine with a result channel.
			// This way the keep-alive loop is NEVER blocked by a stalled TCP connection;
			// we hard-cut after 5s regardless of OS-level TCP timeout (can be 2 min+).
			type pingResult struct{ err error }
			result := make(chan pingResult, 1)
			go func() {
				pingCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
				defer cancel()
				result <- pingResult{err: db.PingContext(pingCtx)}
			}()

			var pingErr error
			select {
			case r := <-result:
				pingErr = r.err
			case <-time.After(5 * time.Second):
				pingErr = fmt.Errorf("ping timed out")
			case <-ctx.Done():
				return
			}

			newState := constant.StatusConnected
			if pingErr != nil {
				newState = constant.StatusError
				s.logger.Warn("keep-alive ping failed", "profile", prof.Name, "err", pingErr)
			}

			if newState != currentState {
				currentState = newState
				s.emitter.Emit(s.ctx, constant.EventConnectionChanged, map[string]any{
					"profile": prof,
					"status":  currentState,
				})
			}
		}
	}
}

func (s *ConnectionService) fetchDatabaseList(db *sql.DB, prof *models.ConnectionProfile) {
	if db == nil || prof == nil {
		return
	}

	s.logger.Info("fetchDatabaseList start",
		"profile", prof.Name,
		"profile_db_name", prof.DBName,
		"driver", prof.Driver,
	)

	dbs, err := dbpkg.FetchDatabases(db, prof.Driver, prof.DBName, prof.ShowAllSchemas, s.logger)
	if err != nil {
		s.logger.Warn("fetch databases failed", "err", err)
		return
	}

	names := make([]string, 0, len(dbs)+4)
	seen := make(map[string]bool)

	if prof.DBName != "" {
		names = append(names, prof.DBName)
		seen[prof.DBName] = true
	}

	for _, d := range dbs {
		if !seen[d.Name] {
			names = append(names, d.Name)
			seen[d.Name] = true
		}
	}

	s.emitter.Emit(s.ctx, "schema:databases", map[string]any{
		"profileName": prof.Name,
		"databases":   names,
	})
}

func (s *ConnectionService) FetchDatabaseSchema(profileName, dbName string) error {
	prof := s.getProfile()
	if prof == nil || prof.Name != profileName {
		return fmt.Errorf("no active connection for profile %q", profileName)
	}
	s.logger.Info("fetching schema", "profile", profileName, "db", dbName)

	go func() {
		clone := *prof
		clone.DBName = dbName
		conn, err := dbpkg.OpenConnection(&clone)
		if err != nil {
			s.logger.Warn("cannot open db for schema fetch", "db", dbName, "err", err)
			s.emitter.Emit(s.ctx, "schema:error", map[string]any{
				"profileName": profileName,
				"dbName":      dbName,
				"error":       err.Error(),
			})
			return
		}
		defer conn.Close()

		prefs := s.getPrefs()
		ctx, cancel := context.WithTimeout(context.Background(), time.Duration(prefs.SchemaTimeout)*time.Second)
		defer cancel()

		d, ok := getDriver(prof.Driver)
		if !ok {
			s.emitter.Emit(s.ctx, "schema:error", map[string]any{
				"profileName": profileName,
				"dbName":      dbName,
				"error":       "driver not found",
			})
			return
		}
		schemas, err := d.FetchSchema(ctx, conn, prof.ShowAllSchemas, s.logger)
		if err != nil {
			s.logger.Warn("fetch schema failed", "db", dbName, "err", err)
			s.emitter.Emit(s.ctx, "schema:error", map[string]any{
				"profileName": profileName,
				"dbName":      dbName,
				"error":       err.Error(),
			})
			return
		}
		s.emitter.Emit(s.ctx, "schema:loaded", map[string]any{
			"profileName": profileName,
			"dbName":      dbName,
			"schemas":     schemas,
		})
	}()
	return nil
}

func (s *ConnectionService) FetchTableColumns(schema, table string) ([]*models.ColumnDef, error) {
	prof := s.getProfile()
	if prof == nil {
		return nil, fmt.Errorf("no active connection")
	}
	db := s.getDB()
	if db == nil {
		return nil, fmt.Errorf("no active connection")
	}
	d, ok := getDriver(prof.Driver)
	if !ok {
		return nil, fmt.Errorf("driver not found")
	}

	prefs := s.getPrefs()
	ctx, cancel := context.WithTimeout(s.ctx, time.Duration(prefs.SchemaTimeout)*time.Second)
	defer cancel()

	s.logger.Info("fetching table columns", "schema", schema, "table", table)
	return d.FetchTableColumns(ctx, db, schema, table)
}

func (s *ConnectionService) AlterTableColumn(schema, table string, old, updated models.ColumnDef) error {
	prof := s.getProfile()
	if prof == nil {
		return fmt.Errorf("no active connection")
	}
	db := s.getDB()
	if db == nil {
		return fmt.Errorf("no active connection")
	}
	d, ok := getDriver(prof.Driver)
	if !ok {
		return fmt.Errorf("driver not found")
	}

	prefs := s.getPrefs()
	ctx, cancel := context.WithTimeout(s.ctx, time.Duration(prefs.SchemaTimeout)*time.Second)
	defer cancel()

	s.logger.Info("altering column", "schema", schema, "table", table, "column", old.Name)
	return d.AlterTableColumn(ctx, db, schema, table, &old, &updated)
}

func (s *ConnectionService) ReorderTableColumns(schema, table string, newOrder []string) error {
	prof := s.getProfile()
	if prof == nil {
		return fmt.Errorf("no active connection")
	}
	db := s.getDB()
	if db == nil {
		return fmt.Errorf("no active connection")
	}
	d, ok := getDriver(prof.Driver)
	if !ok {
		return fmt.Errorf("driver not found")
	}
	prefs := s.getPrefs()
	ctx, cancel := context.WithTimeout(s.ctx, time.Duration(prefs.SchemaTimeout)*time.Second)
	defer cancel()
	s.logger.Info("reordering columns", "schema", schema, "table", table, "newOrder", newOrder)
	return d.ReorderTableColumns(ctx, db, schema, table, newOrder)
}

func (s *ConnectionService) FetchTableRelationships(schema, table string) ([]models.TableRelationship, error) {
	prof := s.getProfile()
	if prof == nil {
		return nil, fmt.Errorf("no active connection")
	}
	db := s.getDB()
	if db == nil {
		return nil, fmt.Errorf("no active connection")
	}
	d, ok := getDriver(prof.Driver)
	if !ok {
		return nil, fmt.Errorf("driver not found")
	}
	prefs := s.getPrefs()
	ctx, cancel := context.WithTimeout(s.ctx, time.Duration(prefs.SchemaTimeout)*time.Second)
	defer cancel()

	s.logger.Info("fetching table relationships", "schema", schema, "table", table)
	return d.FetchTableRelationships(ctx, db, schema, table)
}

func (s *ConnectionService) AddTableColumn(schema, table string, col models.ColumnDef) error {
	prof := s.getProfile()
	if prof == nil {
		return fmt.Errorf("no active connection")
	}
	db := s.getDB()
	if db == nil {
		return fmt.Errorf("no active connection")
	}
	d, ok := getDriver(prof.Driver)
	if !ok {
		return fmt.Errorf("driver not found")
	}

	prefs := s.getPrefs()
	ctx, cancel := context.WithTimeout(s.ctx, time.Duration(prefs.SchemaTimeout)*time.Second)
	defer cancel()

	s.logger.Info("adding column", "schema", schema, "table", table, "column", col.Name)
	return d.AddTableColumn(ctx, db, schema, table, &col)
}

func (s *ConnectionService) DropTableColumn(schema, table, column string) error {
	prof := s.getProfile()
	if prof == nil {
		return fmt.Errorf("no active connection")
	}
	db := s.getDB()
	if db == nil {
		return fmt.Errorf("no active connection")
	}
	d, ok := getDriver(prof.Driver)
	if !ok {
		return fmt.Errorf("driver not found")
	}

	prefs := s.getPrefs()
	ctx, cancel := context.WithTimeout(s.ctx, time.Duration(prefs.SchemaTimeout)*time.Second)
	defer cancel()

	s.logger.Info("dropping column", "schema", schema, "table", table, "column", column)
	return d.DropTableColumn(ctx, db, schema, table, column)
}
