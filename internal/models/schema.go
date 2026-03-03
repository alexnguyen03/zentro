package models

// DatabaseInfo represents a database and its schemas.
// Moved from internal/db to models — shared domain object used by both db layer and UI.
type DatabaseInfo struct {
	Name    string
	Schemas []*SchemaNode
}

// SchemaNode represents a schema and its tables/views.
type SchemaNode struct {
	Name   string
	Tables []string
	Views  []string
}
