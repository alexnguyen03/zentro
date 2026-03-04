package app

import (
	"context"
	"encoding/csv"
	"fmt"
	"os"

	"github.com/wailsapp/wails/v2/pkg/runtime"

	"zentro/internal/core"
	"zentro/internal/driver"
)

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

// getDriver looks up a registered DatabaseDriver by name.
// Pattern: Dependency Inversion — app depends on core.Get (abstraction), not concrete drivers.
func getDriver(name string) (driver.DatabaseDriver, bool) {
	return core.Get(name)
}
