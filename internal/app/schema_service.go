package app

type IndexInfo struct {
	Name    string
	Table   string
	Columns []string
	Unique  bool
}

type CheckConstraintInfo struct {
	Name       string
	Expression string
}

type UniqueConstraintInfo struct {
	Name    string
	Columns []string
}

type PrimaryKeyInfo struct {
	Name    string
	Columns []string
}
