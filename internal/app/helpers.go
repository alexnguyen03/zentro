package app

import (
	"context"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"os"
	"strings"

	"github.com/wailsapp/wails/v2/pkg/runtime"

	"zentro/internal/core"
	"zentro/internal/driver"
)

func (a *App) openJSONFileDialog(title string) (string, error) {
	return runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: title,
		Filters: []runtime.FileFilter{
			{DisplayName: "JSON Files (*.json)", Pattern: "*.json"},
		},
	})
}

func (a *App) saveJSONFileDialog(title string, defaultFilename string) (string, error) {
	return runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		Title:           title,
		DefaultFilename: defaultFilename,
		Filters: []runtime.FileFilter{
			{DisplayName: "JSON Files (*.json)", Pattern: "*.json"},
		},
	})
}

func (a *App) openDirectoryDialog(title string, defaultDir string) (string, error) {
	return runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title:            title,
		DefaultDirectory: defaultDir,
	})
}

// exportCSV opens an OS save dialog and writes CSV to the chosen file.
func exportCSV(ctx context.Context, columns []string, rows [][]string) (string, error) {
	filePath, err := runtime.SaveFileDialog(ctx, runtime.SaveDialogOptions{
		Title:           "Export CSV",
		DefaultFilename: "query_result.csv",
		Filters: []runtime.FileFilter{
			{DisplayName: "CSV Files (*.csv)", Pattern: "*.csv"},
		},
	})
	if err != nil {
		return "", fmt.Errorf("export: dialog: %w", err)
	}
	if filePath == "" {
		return "", nil // user cancelled
	}

	f, err := os.Create(filePath)
	if err != nil {
		return "", fmt.Errorf("export: create file: %w", err)
	}
	defer f.Close()

	// Write UTF-8 BOM so Excel opens the file with correct encoding
	if _, err := f.WriteString("\xEF\xBB\xBF"); err != nil {
		return "", fmt.Errorf("export: write bom: %w", err)
	}

	w := csv.NewWriter(f)
	if len(columns) > 0 {
		_ = w.Write(columns)
	}
	for _, row := range rows {
		_ = w.Write(row)
	}
	w.Flush()
	if err := w.Error(); err != nil {
		return "", fmt.Errorf("export: write csv: %w", err)
	}
	return filePath, nil
}

// exportJSON opens an OS save dialog and writes JSON to the chosen file.
func exportJSON(ctx context.Context, columns []string, rows [][]string) (string, error) {
	filePath, err := runtime.SaveFileDialog(ctx, runtime.SaveDialogOptions{
		Title:           "Export JSON",
		DefaultFilename: "query_result.json",
		Filters: []runtime.FileFilter{
			{DisplayName: "JSON Files (*.json)", Pattern: "*.json"},
		},
	})
	if err != nil {
		return "", fmt.Errorf("export: dialog: %w", err)
	}
	if filePath == "" {
		return "", nil // user cancelled
	}

	// Convert rows to array of objects
	data := make([]map[string]any, len(rows))
	for i, row := range rows {
		obj := make(map[string]any)
		for j, col := range columns {
			if j < len(row) {
				obj[col] = parseCellValue(row[j])
			}
		}
		data[i] = obj
	}

	jsonData, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		return "", fmt.Errorf("export: marshal json: %w", err)
	}

	if err := os.WriteFile(filePath, jsonData, 0644); err != nil {
		return "", fmt.Errorf("export: write file: %w", err)
	}
	return filePath, nil
}

// exportSQLInsert opens an OS save dialog and writes SQL INSERT statements to the chosen file.
func exportSQLInsert(ctx context.Context, columns []string, rows [][]string, tableName string) (string, error) {
	filePath, err := runtime.SaveFileDialog(ctx, runtime.SaveDialogOptions{
		Title:           "Export SQL INSERT",
		DefaultFilename: "query_result.sql",
		Filters: []runtime.FileFilter{
			{DisplayName: "SQL Files (*.sql)", Pattern: "*.sql"},
		},
	})
	if err != nil {
		return "", fmt.Errorf("export: dialog: %w", err)
	}
	if filePath == "" {
		return "", nil // user cancelled
	}

	var sb strings.Builder

	// Add header comment
	sb.WriteString("-- Generated SQL INSERT statements\n")
	sb.WriteString(fmt.Sprintf("-- Table: %s\n", tableName))
	sb.WriteString(fmt.Sprintf("-- Rows: %d\n\n", len(rows)))

	// Generate INSERT statements
	for _, row := range rows {
		if len(columns) == 0 {
			continue
		}

		values := make([]string, len(row))
		for i, val := range row {
			values[i] = formatSQLValue(val)
		}

		cols := strings.Join(columns, ", ")
		vals := strings.Join(values, ", ")
		sb.WriteString(fmt.Sprintf("INSERT INTO %s (%s) VALUES (%s);\n", tableName, cols, vals))
	}

	if err := os.WriteFile(filePath, []byte(sb.String()), 0644); err != nil {
		return "", fmt.Errorf("export: write file: %w", err)
	}
	return filePath, nil
}

// parseCellValue attempts to parse a cell value to appropriate JSON type
func parseCellValue(val string) any {
	if val == "" || val == "NULL" {
		return nil
	}

	// Try to parse as JSON if it looks like JSON
	trimmed := strings.TrimSpace(val)
	if (strings.HasPrefix(trimmed, "{") && strings.HasSuffix(trimmed, "}")) ||
		(strings.HasPrefix(trimmed, "[") && strings.HasSuffix(trimmed, "]")) {
		var jsonVal any
		if err := json.Unmarshal([]byte(trimmed), &jsonVal); err == nil {
			return jsonVal
		}
	}

	// Return as string
	return val
}

// formatSQLValue formats a value for SQL INSERT statement
func formatSQLValue(val string) string {
	if val == "" || val == "NULL" {
		return "NULL"
	}

	// Check if it's a number
	if isNumeric(val) {
		return val
	}

	// Escape single quotes and wrap in quotes
	escaped := strings.ReplaceAll(val, "'", "''")
	return fmt.Sprintf("'%s'", escaped)
}

// isNumeric checks if a string represents a numeric value
func isNumeric(s string) bool {
	if s == "" {
		return false
	}
	_, err := fmt.Sscanf(s, "%f")
	return err == nil
}

// getDriver looks up a registered DatabaseDriver by name.
// Pattern: Dependency Inversion — app depends on core.Get (abstraction), not concrete drivers.
func getDriver(name string) (driver.DatabaseDriver, bool) {
	return core.Get(name)
}
