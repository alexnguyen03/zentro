package models

import "time"

// QueryResult chứa kết quả của một câu lệnh SQL.
// Không serialize ra JSON — chỉ dùng in-memory.
type QueryResult struct {
	Columns  []string        // tên các cột (chỉ có khi IsSelect=true)
	Rows     [][]interface{} // dữ liệu (chỉ có khi IsSelect=true)
	Affected int64           // số rows bị ảnh hưởng (INSERT/UPDATE/DELETE)
	Duration time.Duration   // thời gian thực thi
	Err      error           // lỗi nếu có
	IsSelect bool            // true nếu là SELECT/WITH/SHOW/EXPLAIN
}

// HistoryEntry lưu một lần thực thi query vào history.
type HistoryEntry struct {
	Query      string    `json:"query"`
	ExecutedAt time.Time `json:"executed_at"`
	DurationMs int64     `json:"duration_ms"`
	Success    bool      `json:"success"`
	RowCount   int       `json:"row_count"`
	Profile    string    `json:"profile"` // tên ConnectionProfile đã dùng
}
