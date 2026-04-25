package app

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"zentro/internal/constant"
	dbpkg "zentro/internal/db"
	"zentro/internal/models"
)

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

	EmitVersionedEvent(s.emitter, s.ctx, constant.EventSchemaDatabases, constant.EventSchemaDatabasesV2, SchemaDatabasesEvent{
		ProfileName: prof.Name,
		Databases:   names,
	})
}

func (s *ConnectionService) FetchDatabaseSchema(profileName, dbName string) error {
	prof := s.getProfile()
	if prof == nil || prof.Name != profileName {
		return fmt.Errorf("no active connection for profile %q", profileName)
	}
	s.logger.Info("fetching schema", "profile", profileName, "db", dbName)

	go func() {
		activeProfile := s.getProfile()
		activeDB := s.getDB()
		useActive := activeDB != nil &&
			activeProfile != nil &&
			activeProfile.Name == profileName &&
			activeProfile.DBName == dbName

		var conn *sql.DB
		if useActive {
			conn = activeDB
			s.logDBStats("fetch_schema_reuse_active", conn, activeProfile)
		} else {
			clone := *prof
			clone.DBName = dbName
			var err error
			conn, err = dbpkg.OpenConnection(&clone)
			if err != nil {
				s.logger.Warn("cannot open db for schema fetch", "db", dbName, "err", err)
				EmitVersionedEvent(s.emitter, s.ctx, constant.EventSchemaError, constant.EventSchemaErrorV2, SchemaErrorEvent{
					ProfileName: profileName,
					DBName:      dbName,
					Error:       err.Error(),
				})
				return
			}
			defer conn.Close()
			s.logDBStats("fetch_schema_temp_conn", conn, &clone)
		}

		prefs := s.getPrefs()
		ctx, cancel := context.WithTimeout(context.Background(), time.Duration(prefs.SchemaTimeout)*time.Second)
		defer cancel()

		d, ok := getDriver(prof.Driver)
		if !ok {
			EmitVersionedEvent(s.emitter, s.ctx, constant.EventSchemaError, constant.EventSchemaErrorV2, SchemaErrorEvent{
				ProfileName: profileName,
				DBName:      dbName,
				Error:       "driver not found",
			})
			return
		}
		schemas, err := d.FetchSchema(ctx, conn, prof.ShowAllSchemas, s.logger)
		if err != nil {
			s.logger.Warn("fetch schema failed", "db", dbName, "err", err)
			EmitVersionedEvent(s.emitter, s.ctx, constant.EventSchemaError, constant.EventSchemaErrorV2, SchemaErrorEvent{
				ProfileName: profileName,
				DBName:      dbName,
				Error:       err.Error(),
			})
			return
		}
		EmitVersionedEvent(s.emitter, s.ctx, constant.EventSchemaLoaded, constant.EventSchemaLoadedV2, SchemaLoadedEvent{
			ProfileName: profileName,
			DBName:      dbName,
			Schemas:     schemas,
		})
	}()
	return nil
}
