package models

import "time"

// QueryResult chứa kết quả của một câu lệnh SQL.
// Không serialize ra JSON — chỉ dùng in-memory.
type QueryResult struct {
	Columns    []string        // tên các cột (chỉ có khi IsSelect=true)
	Rows       [][]interface{} // dữ liệu (chỉ có khi IsSelect=true)
	Affected   int64           // số rows bị ảnh hưởng (INSERT/UPDATE/DELETE)
	Duration   time.Duration   // thời gian thực thi
	Err        error           // lỗi nếu có
	IsSelect   bool            // true nếu là SELECT/WITH/SHOW/EXPLAIN
	TableName  string          // tên bảng parse được từ query
	PrimaryKey []string        // danh sách cột khoá chính của bảng đó
}

// HistoryEntry records one query execution.
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
