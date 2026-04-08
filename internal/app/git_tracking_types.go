package app

type GitTrackingStatus struct {
	Enabled        bool   `json:"enabled"`
	Initialized    bool   `json:"initialized"`
	RepoPath       string `json:"repo_path,omitempty"`
	ProjectID      string `json:"project_id,omitempty"`
	LastCommitHash string `json:"last_commit_hash,omitempty"`
	LastError      string `json:"last_error,omitempty"`
	PendingCount   int    `json:"pending_count,omitempty"`
}

type GitTimelineItem struct {
	Hash      string   `json:"hash"`
	Message   string   `json:"message"`
	EventType string   `json:"event_type"`
	Author    string   `json:"author"`
	When      string   `json:"when"`
	Files     []string `json:"files"`
}

type GitCommitFileDiff struct {
	Path   string `json:"path"`
	Before string `json:"before"`
	After  string `json:"after"`
}

type GitCommitResult struct {
	Hash      string   `json:"hash,omitempty"`
	Message   string   `json:"message"`
	Files     []string `json:"files"`
	CreatedAt string   `json:"created_at"`
	NoChanges bool     `json:"no_changes"`
}

type StoredProcedureSnapshot struct {
	Schema     string `json:"schema"`
	Name       string `json:"name"`
	Kind       string `json:"kind"`
	Definition string `json:"definition"`
}

type QueryExecutionAuditEvent struct {
	SourceTabID    string
	TabID          string
	StatementText  string
	StatementIndex int
	StatementCount int
	RowCount       int64
	DurationMs     int64
	IsSelect       bool
	Error          string
}
