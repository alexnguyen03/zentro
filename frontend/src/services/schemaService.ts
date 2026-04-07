import type { models } from '../../wailsjs/go/models';
import { wailsGateway } from '../platform/app-api/wailsGateway';

export const FetchDatabaseSchema = (profileName: string, dbName: string) => wailsGateway.FetchDatabaseSchema(profileName, dbName);
export const FetchTableColumns = (schema: string, table: string) => wailsGateway.FetchTableColumns(schema, table);
export const FetchTableRelationships = (schema: string, table: string) => wailsGateway.FetchTableRelationships(schema, table);
export const CreateTable = (profileName: string, schema: string, tableName: string, columns: models.ColumnDef[]) =>
    wailsGateway.CreateTable(profileName, schema, tableName, columns);
export const DropObject = (profileName: string, schema: string, objectName: string, objectType: string) =>
    wailsGateway.DropObject(profileName, schema, objectName, objectType);
export const GetTableDDL = (profileName: string, schema: string, tableName: string) =>
    wailsGateway.GetTableDDL(profileName, schema, tableName);
export const AlterTableColumn = (profileName: string, schema: string, current: models.ColumnDef, next: models.ColumnDef) =>
    wailsGateway.AlterTableColumn(profileName, schema, current, next);
export const AddTableColumn = (profileName: string, schema: string, col: models.ColumnDef) =>
    wailsGateway.AddTableColumn(profileName, schema, col);
export const DropTableColumn = (profileName: string, schema: string, columnName: string) =>
    wailsGateway.DropTableColumn(profileName, schema, columnName);
export const GetIndexes = (profileName: string, schema: string, table: string) => wailsGateway.GetIndexes(profileName, schema, table);
export const CreateIndex = (profileName: string, schema: string, table: string, indexName: string, columns: string[], unique: boolean) =>
    wailsGateway.CreateIndex(profileName, schema, table, indexName, columns, unique);
export const DropIndex = (profileName: string, schema: string, tableName: string, indexName: string) => wailsGateway.DropIndex(profileName, schema, tableName, indexName);
