import { models } from '../../../../wailsjs/go/models';
import type { UiAction } from '../../../types/uiAction';

export interface RowState {
    id: string; // stable dnd id
    original: models.ColumnDef;
    current: models.ColumnDef;
    deleted: boolean;
    isNew?: boolean;
}

export type SubTab = 'info' | 'data' | 'erd';
export type SortDir = 'asc' | 'desc' | null;
export type SortCol = 'idx' | 'Name' | 'DataType' | 'IsPrimaryKey' | 'IsNullable' | 'DefaultValue';

export type TabAction = UiAction;
