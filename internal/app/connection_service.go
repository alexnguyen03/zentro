package app

import (
	"context"
	"database/sql"
	"fmt"
	"log/slog"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"

	dbpkg "zentro/internal/db"
	"zentro/internal/models"
	"zentro/internal/utils"
)

type ConnectionService struct {
	ctx        context.Context
	logger     *slog.Logger
	getPrefs   func() utils.Preferences
	getDB      func() *sql.DB
	getProfile func() *models.ConnectionProfile
	setDB      func(*sql.DB, *models.ConnectionProfile)
}

func NewConnectionService(
	ctx context.Context, logger *slog.Logger, getPrefs func() utils.Preferences,
	getDB func() *sql.DB, getProfile func() *models.ConnectionProfile,
	setDB func(*sql.DB, *models.ConnectionProfile),
) *ConnectionService {
	return &ConnectionService{
		ctx:        ctx,
		logger:     logger,
		getPrefs:   getPrefs,
		getDB:      getDB,
		getProfile: getProfile,
		setDB:      setDB,
	}
}

// Ensure context is up-to-date
func (s *ConnectionService) SetContext(ctx context.Context) {
	s.ctx = ctx
}

func (s *ConnectionService) LoadConnections() ([]*models.ConnectionProfile, error) {
	return utils.LoadConnections()
}

func (s *ConnectionService) SaveConnection(p models.ConnectionProfile) error {
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

	s.logger.Info("connecting",
		"profile", name,
		"driver", prof.Driver,
		"host", prof.Host,
		"port", prof.Port,
		"db_name", prof.DBName,
		"ssl_mode", prof.SSLMode,
	)
	db, err := dbpkg.OpenConnection(prof)
	if err != nil {
		s.logger.Error("open connection failed", "profile", name, "err", err)
		return dbpkg.FriendlyError(prof.Driver, err)
	}

	prefs := s.getPrefs()
	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(prefs.ConnectTimeout)*time.Second)
	defer cancel()
	if err := db.PingContext(ctx); err != nil {
		db.Close()
		s.logger.Error("ping failed", "profile", name, "err", err)
		return dbpkg.FriendlyError(prof.Driver, err)
	}

	previousDB := s.getDB()
	if previousDB != nil {
		_ = previousDB.Close()
	}

	s.setDB(db, prof)

	emitEvent(s.ctx, "connection:changed", map[string]any{
		"profile": prof,
		"status":  "connected",
	})
	s.logger.Info("connected — emitted connection:changed",
		"profile", name,
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

	db, err := dbpkg.OpenConnection(&clone)
	if err != nil {
		s.logger.Error("switch database failed", "db", dbName, "err", err)
		return dbpkg.FriendlyError(clone.Driver, err)
	}

	prefs := s.getPrefs()
	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(prefs.ConnectTimeout)*time.Second)
	defer cancel()
	if err := db.PingContext(ctx); err != nil {
		db.Close()
		s.logger.Error("ping failed on new db", "db", dbName, "err", err)
		return dbpkg.FriendlyError(clone.Driver, err)
	}

	previousDB := s.getDB()
	if previousDB != nil {
		_ = previousDB.Close()
	}

	s.setDB(db, &clone)

	s.logger.Info("switched database ok")
	emitEvent(s.ctx, "connection:changed", map[string]any{
		"profile": &clone,
		"status":  "connected",
	})

	go s.fetchDatabaseList(db, &clone)
	return nil
}

func (s *ConnectionService) Disconnect() {
	db := s.getDB()
	if db != nil {
		_ = db.Close()
	}
	s.setDB(nil, nil)
	emitEvent(s.ctx, "connection:changed", map[string]any{"status": "disconnected"})
	runtime.WindowSetTitle(s.ctx, "Zentro")
	s.logger.Info("disconnected")
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

	allProfiles, loadErr := utils.LoadConnections()
	if loadErr == nil {
		for _, p := range allProfiles {
			if p.Driver == prof.Driver &&
				p.Host == prof.Host &&
				p.Port == prof.Port &&
				p.DBName != "" &&
				!seen[p.DBName] {
				names = append(names, p.DBName)
				seen[p.DBName] = true
			}
		}
	}

	emitEvent(s.ctx, "schema:databases", map[string]any{
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
			emitEvent(s.ctx, "schema:error", map[string]any{
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
			emitEvent(s.ctx, "schema:error", map[string]any{
				"profileName": profileName,
				"dbName":      dbName,
				"error":       "driver not found",
			})
			return
		}
		schemas, err := d.FetchSchema(ctx, conn, prof.ShowAllSchemas, s.logger)
		if err != nil {
			s.logger.Warn("fetch schema failed", "db", dbName, "err", err)
			emitEvent(s.ctx, "schema:error", map[string]any{
				"profileName": profileName,
				"dbName":      dbName,
				"error":       err.Error(),
			})
			return
		}
		emitEvent(s.ctx, "schema:loaded", map[string]any{
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
