package app

import (
	"database/sql"
	"fmt"
	"strings"
)

func fetchPostgresRoutineSnapshots(db *sql.DB, schema string) ([]StoredProcedureSnapshot, error) {
	if db == nil {
		return nil, fmt.Errorf("db is nil")
	}

	trimmedSchema := strings.TrimSpace(schema)
	baseQuery := `
		SELECT
			n.nspname AS schema_name,
			p.proname AS routine_name,
			CASE p.prokind
				WHEN 'p' THEN 'procedure'
				ELSE 'function'
			END AS routine_kind,
			pg_get_functiondef(p.oid) AS routine_def
		FROM pg_proc p
		JOIN pg_namespace n ON n.oid = p.pronamespace
		WHERE p.prokind IN ('f', 'p')
			AND n.nspname NOT IN ('pg_catalog', 'information_schema')
	`

	args := []any{}
	if trimmedSchema != "" {
		baseQuery += " AND n.nspname = $1"
		args = append(args, trimmedSchema)
	}
	baseQuery += " ORDER BY n.nspname, p.proname"

	rows, err := db.Query(baseQuery, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []StoredProcedureSnapshot{}
	for rows.Next() {
		var snap StoredProcedureSnapshot
		if err := rows.Scan(&snap.Schema, &snap.Name, &snap.Kind, &snap.Definition); err != nil {
			return nil, err
		}
		out = append(out, snap)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return out, nil
}
