package models

// ColumnDef holds the schema information for a single column.
type ColumnDef struct {
	Name         string `json:"Name"`
	DataType     string `json:"DataType"`
	IsPrimaryKey bool   `json:"IsPrimaryKey"`
	IsNullable   bool   `json:"IsNullable"`
	DefaultValue string `json:"DefaultValue"`
}

// TableRelationship represents a foreign key constraint between two tables.
// It can be outgoing (SourceTable = current table) or incoming (TargetTable = current table).
type TableRelationship struct {
	ConstraintName string `json:"ConstraintName"`
	SourceSchema   string `json:"SourceSchema"`
	SourceTable    string `json:"SourceTable"`
	SourceColumn   string `json:"SourceColumn"`
	TargetSchema   string `json:"TargetSchema"`
	TargetTable    string `json:"TargetTable"`
	TargetColumn   string `json:"TargetColumn"`
}

// DatabaseInfo represents a database and its schemas.
type DatabaseInfo struct {
	Name    string
	Schemas []*SchemaNode
}

// SchemaNode represents a schema and all its object categories.
// Every slice is initialized as []string{} (never nil) so JSON serializes as [] not null.
type SchemaNode struct {
	Name               string   `json:"Name"`
	Tables             []string `json:"Tables"`
	ForeignTables      []string `json:"ForeignTables"`
	Views              []string `json:"Views"`
	MaterializedViews  []string `json:"MaterializedViews"`
	Indexes            []string `json:"Indexes"`
	Functions          []string `json:"Functions"`
	Procedures         []string `json:"Procedures"`
	Sequences          []string `json:"Sequences"`
	DataTypes          []string `json:"DataTypes"`
	AggregateFunctions []string `json:"AggregateFunctions"`
}

// NewSchemaNode returns a SchemaNode with all slices initialized to empty (not nil).
func NewSchemaNode(name string) *SchemaNode {
	return &SchemaNode{
		Name:               name,
		Tables:             []string{},
		ForeignTables:      []string{},
		Views:              []string{},
		MaterializedViews:  []string{},
		Indexes:            []string{},
		Functions:          []string{},
		Procedures:         []string{},
		Sequences:          []string{},
		DataTypes:          []string{},
		AggregateFunctions: []string{},
	}
}
