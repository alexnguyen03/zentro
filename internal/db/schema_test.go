package db

import (
	"testing"
)

func TestFetchDatabases_UnknownDriver(t *testing.T) {
	_, err := FetchDatabases(nil, unknownDriver, "mydb", false, nil)
	if err == nil {
		t.Fatal("expected error for unknown driver")
	}
}

func TestFetchTablePrimaryKeys_UnknownDriver(t *testing.T) {
	_, err := FetchTablePrimaryKeys(nil, unknownDriver, "public", "users")
	if err == nil {
		t.Fatal("expected error for unknown driver")
	}
}

func TestFetchAllDatabaseSchemas_UnknownDriver(t *testing.T) {
	// Should return early without panic when driver is unknown.
	FetchAllDatabaseSchemas(nil, "mydb", unknownDriver, false, nil, nil)
}
