package app

import (
	"context"
	"fmt"
	"time"

	"zentro/internal/models"
)

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
