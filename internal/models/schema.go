package models

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
		Sequences:          []string{},
		DataTypes:          []string{},
		AggregateFunctions: []string{},
	}
}
