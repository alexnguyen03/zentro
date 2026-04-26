import type { SchemaNode } from '../../stores/schemaStore';
import { getSchemasForActiveDatabase } from '../../lib/monaco/sqlCompletionIdentifiers';
import { resolveTableNavigationAtPosition, type SqlModelLike, type SqlPositionLike, type TableNavigationMatch } from '../../lib/monaco/sqlTableNavigation';

export interface TableNavigationProfileLike {
    name?: string;
    db_name?: string;
}

export interface RunCtrlClickTableNavigationArgs {
    model: SqlModelLike;
    position: SqlPositionLike;
    profile: TableNavigationProfileLike | null | undefined;
    trees: Record<string, SchemaNode[]>;
    onOpenTable: (target: TableNavigationMatch) => void;
    onShowHint: (message: string, position: SqlPositionLike) => void;
    onShowPicker: (matches: TableNavigationMatch[], position: SqlPositionLike, onPick: (target: TableNavigationMatch) => void) => void;
}

export type CtrlClickNavigationResult = 'navigated' | 'picker' | 'hint';

export function runCtrlClickTableNavigation(args: RunCtrlClickTableNavigationArgs): CtrlClickNavigationResult {
    const { model, position, profile, trees, onOpenTable, onShowHint, onShowPicker } = args;
    const profileName = profile?.name || '';
    const dbName = profile?.db_name || '';

    if (!profileName || !dbName) {
        onShowHint('Khong tim thay table trong context', position);
        return 'hint';
    }

    const schemas = getSchemasForActiveDatabase(trees, profileName, dbName);
    const navigation = resolveTableNavigationAtPosition(model, position, schemas);

    if (navigation.kind === 'single_match') {
        onOpenTable(navigation.match);
        return 'navigated';
    }

    if (navigation.kind === 'multiple_matches') {
        onShowPicker(navigation.matches, position, onOpenTable);
        return 'picker';
    }

    const label = navigation.lookup ? `Khong tim thay table: ${navigation.lookup}` : 'Khong tim thay table trong context';
    onShowHint(label, position);
    return 'hint';
}
