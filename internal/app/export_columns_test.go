package app

import "testing"

func TestFilterExportColumns_Subset(t *testing.T) {
	columns := []string{"id", "name", "status"}
	rows := [][]string{
		{"1", "Alice", "active"},
		{"2", "Bob", "inactive"},
	}

	filteredColumns, filteredRows, err := filterExportColumns(columns, rows, []string{"status", "id"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(filteredColumns) != 2 || filteredColumns[0] != "status" || filteredColumns[1] != "id" {
		t.Fatalf("unexpected filtered columns: %#v", filteredColumns)
	}
	if len(filteredRows) != 2 || len(filteredRows[0]) != 2 {
		t.Fatalf("unexpected filtered row shape: %#v", filteredRows)
	}
	if filteredRows[0][0] != "active" || filteredRows[0][1] != "1" {
		t.Fatalf("unexpected first row values: %#v", filteredRows[0])
	}
}

func TestFilterExportColumns_UnknownColumn(t *testing.T) {
	columns := []string{"id", "name"}
	rows := [][]string{{"1", "Alice"}}

	_, _, err := filterExportColumns(columns, rows, []string{"missing"})
	if err == nil {
		t.Fatalf("expected error for unknown column")
	}
}
