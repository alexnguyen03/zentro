package driver_test

import (
	"testing"

	"zentro/internal/driver"
	"zentro/internal/driver/mssql"
	"zentro/internal/driver/mysql"
	"zentro/internal/driver/postgres"
	"zentro/internal/driver/sqlite"
)

func TestDriversImplementDatabaseDriverContract(t *testing.T) {
	var driversUnderTest = []driver.DatabaseDriver{
		postgres.New(),
		mssql.New(),
		mysql.New(),
		sqlite.New(),
	}

	for _, d := range driversUnderTest {
		if d.Name() == "" {
			t.Fatalf("driver name must not be empty")
		}
		if d.Name() != "mysql" && d.DefaultSchema() == "" {
			t.Fatalf("driver %s default schema must not be empty", d.Name())
		}
	}
}
