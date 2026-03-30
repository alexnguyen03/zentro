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

	return s.LoadDatabasesForConnectionProfile(prof)
}

func (s *ConnectionService) LoadDatabasesForConnectionProfile(prof *models.ConnectionProfile) ([]string, error) {
	if prof == nil {
		return nil, fmt.Errorf("connection profile is required")
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

	EmitVersionedEvent(s.emitter, s.ctx, constant.EventConnectionChanged, constant.EventConnectionChangedV2, ConnectionChangedEvent{
		Profile: prof,
		Status:  constant.StatusConnecting,
	})

	db, err := dbpkg.OpenConnection(prof)
	if err != nil {
		s.logger.Error("open connection failed", "profile", prof.Name, "err", err)
		fErr := dbpkg.FriendlyError(prof.Driver, err)
		EmitVersionedEvent(s.emitter, s.ctx, constant.EventConnectionChanged, constant.EventConnectionChangedV2, ConnectionChangedEvent{
			Profile: prof,
			Status:  constant.StatusError,
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
		EmitVersionedEvent(s.emitter, s.ctx, constant.EventConnectionChanged, constant.EventConnectionChangedV2, ConnectionChangedEvent{
			Profile: prof,
			Status:  constant.StatusError,
		})
		return fErr
	}

	// Connection successful, update store
	s.setDB(db, prof)

	kaCtx, kaCancel := context.WithCancel(context.Background())
	s.keepAliveCancel = kaCancel
	go s.startKeepAlive(kaCtx, db, prof)

	EmitVersionedEvent(s.emitter, s.ctx, constant.EventConnectionChanged, constant.EventConnectionChangedV2, ConnectionChangedEvent{
		Profile: prof,
		Status:  constant.StatusConnected,
	})
	s.logger.Info("connected and emitted connection changed event",
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

	EmitVersionedEvent(s.emitter, s.ctx, constant.EventConnectionChanged, constant.EventConnectionChangedV2, ConnectionChangedEvent{
		Profile: &clone,
		Status:  constant.StatusConnecting,
	})

	db, err := dbpkg.OpenConnection(&clone)
	if err != nil {
		s.logger.Error("switch database failed", "db", dbName, "err", err)
		fErr := dbpkg.FriendlyError(clone.Driver, err)
		EmitVersionedEvent(s.emitter, s.ctx, constant.EventConnectionChanged, constant.EventConnectionChangedV2, ConnectionChangedEvent{
			Profile: &clone,
			Status:  constant.StatusError,
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
		EmitVersionedEvent(s.emitter, s.ctx, constant.EventConnectionChanged, constant.EventConnectionChangedV2, ConnectionChangedEvent{
			Profile: &clone,
			Status:  constant.StatusError,
		})
		return fErr
	}

	s.setDB(db, &clone)

	kaCtx, kaCancel := context.WithCancel(context.Background())
	s.keepAliveCancel = kaCancel
	go s.startKeepAlive(kaCtx, db, &clone)

	s.logger.Info("switched database ok")
	EmitVersionedEvent(s.emitter, s.ctx, constant.EventConnectionChanged, constant.EventConnectionChangedV2, ConnectionChangedEvent{
		Profile: &clone,
		Status:  constant.StatusConnected,
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
	EmitVersionedEvent(s.emitter, s.ctx, constant.EventConnectionChanged, constant.EventConnectionChangedV2, ConnectionChangedEvent{
		Status: constant.StatusDisconnected,
	})
	runtime.WindowSetTitle(s.ctx, "Zentro")
	s.logger.Info("disconnected")
}

func (s *ConnectionService) GetConnectionStatus() (ConnectionRuntimeState, error) {
	prof := s.getProfile()
	db := s.getDB()
	status := constant.StatusDisconnected
	if db != nil {
		status = constant.StatusConnected
	}
	return ConnectionRuntimeState{
		Profile: prof,
		Status:  status,
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
				EmitVersionedEvent(s.emitter, s.ctx, constant.EventConnectionChanged, constant.EventConnectionChangedV2, ConnectionChangedEvent{
					Profile: prof,
					Status:  currentState,
				})
			}
		}
	}
}
