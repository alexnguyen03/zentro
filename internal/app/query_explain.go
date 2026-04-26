package app

import (
	"fmt"
	"strings"

	"zentro/internal/constant"
)

func buildExplainQuery(driver, query string, analyze bool) (string, error) {
	trimmed := strings.TrimSpace(strings.TrimRight(query, ";"))
	if trimmed == "" {
		return "", fmt.Errorf("no query to explain")
	}

	switch driver {
	case constant.DriverPostgres:
		if analyze {
			return fmt.Sprintf("EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) %s", trimmed), nil
		}
		return fmt.Sprintf("EXPLAIN (FORMAT JSON) %s", trimmed), nil
	case constant.DriverMySQL:
		if analyze {
			return fmt.Sprintf("EXPLAIN ANALYZE %s", trimmed), nil
		}
		return fmt.Sprintf("EXPLAIN FORMAT=JSON %s", trimmed), nil
	case constant.DriverSQLite:
		if analyze {
			return "", fmt.Errorf("EXPLAIN ANALYZE is not supported for sqlite in this sprint")
		}
		return fmt.Sprintf("EXPLAIN QUERY PLAN %s", trimmed), nil
	case constant.DriverSQLServer:
		return "", fmt.Errorf("EXPLAIN is not supported for sqlserver in this sprint")
	default:
		return "", fmt.Errorf("EXPLAIN is not supported for driver %q", driver)
	}
}
