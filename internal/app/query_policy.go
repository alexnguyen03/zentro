package app

import "strings"

type ExecutionPolicy struct {
	TimeoutSeconds        int    `json:"timeout_seconds"`
	RowCapPerTab          int    `json:"row_cap_per_tab"`
	DestructiveRules      string `json:"destructive_rules"`
	EnvironmentStrictness string `json:"environment_strictness"`
}

func (a *App) GetExecutionPolicy(environmentKey string) ExecutionPolicy {
	strict := strings.EqualFold(environmentKey, "pro") || strings.EqualFold(environmentKey, "sta")
	rowCap := 100000
	if strict {
		rowCap = 50000
	}

	timeout := a.prefs.QueryTimeout
	if timeout <= 0 {
		timeout = 60
	}

	return ExecutionPolicy{
		TimeoutSeconds:        timeout,
		RowCapPerTab:          rowCap,
		DestructiveRules:      "prompt",
		EnvironmentStrictness: map[bool]string{true: "strict", false: "normal"}[strict],
	}
}
