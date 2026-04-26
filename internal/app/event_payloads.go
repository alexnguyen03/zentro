package app

import "zentro/internal/models"

type ConnectionRuntimeState struct {
	Profile *models.ConnectionProfile `json:"profile,omitempty"`
	Status  string                    `json:"status"`
}

type ConnectionChangedEvent struct {
	Profile *models.ConnectionProfile `json:"profile,omitempty"`
	Status  string                    `json:"status"`
}

type SchemaDatabasesEvent struct {
	ProfileName string   `json:"profileName"`
	Databases   []string `json:"databases"`
}

type SchemaErrorEvent struct {
	ProfileName string `json:"profileName"`
	DBName      string `json:"dbName"`
	Error       string `json:"error"`
}

type SchemaLoadedEvent struct {
	ProfileName string               `json:"profileName"`
	DBName      string               `json:"dbName"`
	Schemas     []*models.SchemaNode `json:"schemas"`
}

type QueryStartedEvent struct {
	TabID          string `json:"tabID"`
	SourceTabID    string `json:"sourceTabID"`
	Query          string `json:"query"`
	StatementText  string `json:"statementText"`
	StatementIndex int    `json:"statementIndex"`
	StatementCount int    `json:"statementCount"`
}

type QueryChunkEvent struct {
	TabID          string     `json:"tabID"`
	SourceTabID    string     `json:"sourceTabID"`
	Columns        []string   `json:"columns,omitempty"`
	Rows           [][]string `json:"rows"`
	Seq            int        `json:"seq"`
	StatementIndex int        `json:"statementIndex"`
	StatementCount int        `json:"statementCount"`
	StatementText  string     `json:"statementText"`
	TableName      string     `json:"tableName,omitempty"`
	PrimaryKeys    []string   `json:"primaryKeys,omitempty"`
}

type QueryDoneEvent struct {
	TabID          string `json:"tabID"`
	SourceTabID    string `json:"sourceTabID"`
	Affected       int64  `json:"affected"`
	Duration       int64  `json:"duration"`
	IsSelect       bool   `json:"isSelect"`
	HasMore        bool   `json:"hasMore"`
	StatementIndex int    `json:"statementIndex"`
	StatementCount int    `json:"statementCount"`
	StatementText  string `json:"statementText"`
	Error          string `json:"error,omitempty"`
}

type TransactionStatusEvent struct {
	Status string `json:"status"`
	Driver string `json:"driver"`
	Error  string `json:"error,omitempty"`
}
