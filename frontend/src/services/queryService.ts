import { wailsGateway } from '../platform/app-api/wailsGateway';

export const ExecuteQuery = (tabId: string, query: string) => wailsGateway.ExecuteQuery(tabId, query);
export const CancelQuery = (tabId: string) => wailsGateway.CancelQuery(tabId);
export const ExplainQuery = (tabId: string, query: string, analyze: boolean) => wailsGateway.ExplainQuery(tabId, query, analyze);
export const ExecuteUpdateSync = (sql: string) => wailsGateway.ExecuteUpdateSync(sql);
export const FetchMoreRows = (tabId: string, offset: number) => wailsGateway.FetchMoreRows(tabId, offset);
export const FetchTotalRowCount = (tabId: string) => wailsGateway.FetchTotalRowCount(tabId);
export const FormatSQL = (query: string, driver: string) => wailsGateway.FormatSQL(query, driver);
export const CompareQueries = (original: string, modified: string) => wailsGateway.CompareQueries(original, modified);
export const ExportCSV = (columns: string[], rows: unknown[]) => wailsGateway.ExportCSV(columns, rows);
export const ExportJSON = (columns: string[], rows: unknown[]) => wailsGateway.ExportJSON(columns, rows);
export const ExportSQLInsert = (columns: string[], rows: unknown[], tableName: string) => wailsGateway.ExportSQLInsert(columns, rows, tableName);
export const BeginTransaction = () => wailsGateway.BeginTransaction();
export const CommitTransaction = () => wailsGateway.CommitTransaction();
export const RollbackTransaction = () => wailsGateway.RollbackTransaction();
export const GetTransactionStatus = () => wailsGateway.GetTransactionStatus();
