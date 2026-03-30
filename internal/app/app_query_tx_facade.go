package app

func (a *App) ExecuteQuery(tabID, query string) { a.query.ExecuteQuery(tabID, query) }

func (a *App) ExplainQuery(tabID, query string, analyze bool) error {
	return a.query.ExplainQuery(tabID, query, analyze)
}

func (a *App) FetchMoreRows(tabID string, offset int) { a.query.FetchMoreRows(tabID, offset) }

func (a *App) FetchTotalRowCount(tabID string) (int64, error) {
	return a.query.FetchTotalRowCount(tabID)
}

func (a *App) CancelQuery(tabID string) { a.query.CancelQuery(tabID) }

func (a *App) ExecuteUpdateSync(query string) (int64, error) {
	if err := a.ensureWritable("execute update"); err != nil {
		return 0, err
	}
	return a.query.ExecuteUpdateSync(query)
}

func (a *App) BeginTransaction() error {
	if err := a.ensureWritable("begin transaction"); err != nil {
		return err
	}
	return a.tx.BeginTransaction()
}

func (a *App) CommitTransaction() error {
	if err := a.ensureWritable("commit transaction"); err != nil {
		return err
	}
	return a.tx.CommitTransaction()
}

func (a *App) RollbackTransaction() error            { return a.tx.RollbackTransaction() }
func (a *App) GetTransactionStatus() (string, error) { return a.tx.GetTransactionStatus() }
