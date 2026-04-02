package app

import "fmt"

func filterExportColumns(columns []string, rows [][]string, selectedColumns []string) ([]string, [][]string, error) {
	if len(selectedColumns) == 0 {
		return columns, rows, nil
	}

	indexByColumn := make(map[string]int, len(columns))
	for idx, name := range columns {
		if _, exists := indexByColumn[name]; exists {
			continue
		}
		indexByColumn[name] = idx
	}

	selectedIndexes := make([]int, 0, len(selectedColumns))
	filteredColumns := make([]string, 0, len(selectedColumns))
	for _, col := range selectedColumns {
		idx, ok := indexByColumn[col]
		if !ok {
			return nil, nil, fmt.Errorf("column %q not found in query result", col)
		}
		selectedIndexes = append(selectedIndexes, idx)
		filteredColumns = append(filteredColumns, col)
	}

	filteredRows := make([][]string, len(rows))
	for rowIdx, row := range rows {
		filtered := make([]string, len(selectedIndexes))
		for i, colIdx := range selectedIndexes {
			if colIdx >= 0 && colIdx < len(row) {
				filtered[i] = row[colIdx]
			}
		}
		filteredRows[rowIdx] = filtered
	}

	return filteredColumns, filteredRows, nil
}
