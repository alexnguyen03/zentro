import { ENVIRONMENT_KEY } from '../../lib/constants';
import type { SafetyLevel } from './policyProfiles';

export type WriteOperationKind =
    | 'update'
    | 'delete'
    | 'alter'
    | 'drop'
    | 'truncate'
    | 'merge'
    | 'replace'
    | 'insert'
    | 'create'
    | 'other_write'
    | 'read'
    | 'unknown';

export interface StatementRiskAnalysis {
    statement: string;
    operation: WriteOperationKind;
    hasWhere: boolean;
    destructive: boolean;
    updateNoWhere: boolean;
    deleteNoWhere: boolean;
}

export interface SqlRiskAnalysis {
    statements: StatementRiskAnalysis[];
    operations: WriteOperationKind[];
    hasWrite: boolean;
    hasDestructive: boolean;
    hasUpdateNoWhere: boolean;
    hasDeleteNoWhere: boolean;
}

export interface OperationRiskAnalysis {
    operations: WriteOperationKind[];
    hasWrite: boolean;
    hasDestructive: boolean;
    hasUpdateNoWhere: boolean;
    hasDeleteNoWhere: boolean;
}

export interface WriteSafetyDecision {
    action: 'allow' | 'confirm' | 'block';
    title: string;
    message: string;
    description: string;
    confirmLabel: string;
    requiresDoubleConfirm: boolean;
    severity: 'primary' | 'danger';
}

const WRITE_OPS = new Set<WriteOperationKind>([
    'update',
    'delete',
    'alter',
    'drop',
    'truncate',
    'merge',
    'replace',
    'insert',
    'create',
    'other_write',
]);

const DESTRUCTIVE_OPS = new Set<WriteOperationKind>([
    'update',
    'delete',
    'alter',
    'drop',
    'truncate',
    'merge',
    'replace',
]);

const KEYWORD_OP_MAP: Record<string, WriteOperationKind> = {
    update: 'update',
    delete: 'delete',
    alter: 'alter',
    drop: 'drop',
    truncate: 'truncate',
    merge: 'merge',
    replace: 'replace',
    insert: 'insert',
    create: 'create',
    select: 'read',
    show: 'read',
    explain: 'read',
    describe: 'read',
    desc: 'read',
};

const OPERATION_LOOKUP_ORDER = [
    'update',
    'delete',
    'alter',
    'drop',
    'truncate',
    'merge',
    'replace',
    'insert',
    'create',
    'select',
    'show',
    'explain',
    'describe',
    'desc',
];

export function splitSqlStatements(sql: string): string[] {
    const statements: string[] = [];
    let current = '';
    let inSingle = false;
    let inDouble = false;
    let inBacktick = false;
    let inBracket = false;
    let inLineComment = false;
    let inBlockComment = false;

    for (let i = 0; i < sql.length; i++) {
        const ch = sql[i];
        const next = i + 1 < sql.length ? sql[i + 1] : '';

        if (inLineComment) {
            current += ch;
            if (ch === '\n') {
                inLineComment = false;
            }
            continue;
        }

        if (inBlockComment) {
            current += ch;
            if (ch === '*' && next === '/') {
                current += next;
                i++;
                inBlockComment = false;
            }
            continue;
        }

        if (!inSingle && !inDouble && !inBacktick && !inBracket) {
            if (ch === '-' && next === '-') {
                current += ch + next;
                i++;
                inLineComment = true;
                continue;
            }
            if (ch === '/' && next === '*') {
                current += ch + next;
                i++;
                inBlockComment = true;
                continue;
            }
        }

        if (ch === '\'' && !inDouble && !inBacktick && !inBracket) {
            current += ch;
            if (inSingle && next === '\'') {
                current += next;
                i++;
            } else {
                inSingle = !inSingle;
            }
            continue;
        }

        if (ch === '"' && !inSingle && !inBacktick && !inBracket) {
            current += ch;
            if (inDouble && next === '"') {
                current += next;
                i++;
            } else {
                inDouble = !inDouble;
            }
            continue;
        }

        if (ch === '`' && !inSingle && !inDouble && !inBracket) {
            current += ch;
            inBacktick = !inBacktick;
            continue;
        }

        if (ch === '[' && !inSingle && !inDouble && !inBacktick) {
            inBracket = true;
            current += ch;
            continue;
        }

        if (ch === ']' && inBracket) {
            inBracket = false;
            current += ch;
            continue;
        }

        if (
            ch === ';'
            && !inSingle
            && !inDouble
            && !inBacktick
            && !inBracket
        ) {
            const statement = current.trim();
            if (statement) {
                statements.push(statement);
            }
            current = '';
            continue;
        }

        current += ch;
    }

    const finalStatement = current.trim();
    if (finalStatement) {
        statements.push(finalStatement);
    }

    return statements;
}

function tokenizeSql(sql: string): string[] {
    const tokens: string[] = [];
    let word = '';
    let inSingle = false;
    let inDouble = false;
    let inBacktick = false;
    let inBracket = false;
    let inLineComment = false;
    let inBlockComment = false;

    const flushWord = () => {
        if (!word) return;
        tokens.push(word.toLowerCase());
        word = '';
    };

    for (let i = 0; i < sql.length; i++) {
        const ch = sql[i];
        const next = i + 1 < sql.length ? sql[i + 1] : '';

        if (inLineComment) {
            if (ch === '\n') {
                inLineComment = false;
            }
            continue;
        }

        if (inBlockComment) {
            if (ch === '*' && next === '/') {
                i++;
                inBlockComment = false;
            }
            continue;
        }

        if (!inSingle && !inDouble && !inBacktick && !inBracket) {
            if (ch === '-' && next === '-') {
                flushWord();
                i++;
                inLineComment = true;
                continue;
            }
            if (ch === '/' && next === '*') {
                flushWord();
                i++;
                inBlockComment = true;
                continue;
            }
        }

        if (ch === '\'' && !inDouble && !inBacktick && !inBracket) {
            flushWord();
            if (inSingle && next === '\'') {
                i++;
            } else {
                inSingle = !inSingle;
            }
            continue;
        }

        if (ch === '"' && !inSingle && !inBacktick && !inBracket) {
            flushWord();
            if (inDouble && next === '"') {
                i++;
            } else {
                inDouble = !inDouble;
            }
            continue;
        }

        if (ch === '`' && !inSingle && !inDouble && !inBracket) {
            flushWord();
            inBacktick = !inBacktick;
            continue;
        }

        if (ch === '[' && !inSingle && !inDouble && !inBacktick) {
            flushWord();
            inBracket = true;
            continue;
        }

        if (ch === ']' && inBracket) {
            flushWord();
            inBracket = false;
            continue;
        }

        if (inSingle || inDouble || inBacktick || inBracket) {
            continue;
        }

        if (/[a-zA-Z_]/.test(ch)) {
            word += ch;
            continue;
        }

        if (/[0-9$]/.test(ch) && word) {
            word += ch;
            continue;
        }

        flushWord();
    }

    flushWord();
    return tokens;
}

function resolveStatementOperation(tokens: string[]): WriteOperationKind {
    if (tokens.length === 0) return 'unknown';

    let candidate = tokens[0];
    if (candidate === 'with') {
        candidate = OPERATION_LOOKUP_ORDER.find((keyword) => tokens.includes(keyword)) || 'unknown';
    }

    return KEYWORD_OP_MAP[candidate] || 'unknown';
}

export function analyzeStatementRisk(statement: string): StatementRiskAnalysis {
    const trimmed = statement.trim();
    const tokens = tokenizeSql(trimmed);
    const operation = resolveStatementOperation(tokens);
    const hasWhere = tokens.includes('where');
    const destructive = DESTRUCTIVE_OPS.has(operation);
    const updateNoWhere = operation === 'update' && !hasWhere;
    const deleteNoWhere = operation === 'delete' && !hasWhere;

    return {
        statement: trimmed,
        operation,
        hasWhere,
        destructive,
        updateNoWhere,
        deleteNoWhere,
    };
}

export function analyzeSqlRisk(sql: string): SqlRiskAnalysis {
    const statements = splitSqlStatements(sql);
    const targets = statements.length > 0 ? statements : [sql];
    const analyses = targets
        .map((statement) => analyzeStatementRisk(statement))
        .filter((result) => result.statement.length > 0);

    const opSet = new Set<WriteOperationKind>();
    analyses.forEach((item) => {
        if (item.operation !== 'unknown') {
            opSet.add(item.operation);
        }
    });

    return {
        statements: analyses,
        operations: Array.from(opSet),
        hasWrite: analyses.some((item) => WRITE_OPS.has(item.operation)),
        hasDestructive: analyses.some((item) => item.destructive),
        hasUpdateNoWhere: analyses.some((item) => item.updateNoWhere),
        hasDeleteNoWhere: analyses.some((item) => item.deleteNoWhere),
    };
}

export function analyzeOperationRisk(operations: WriteOperationKind[]): OperationRiskAnalysis {
    const filtered = operations.filter((operation) => operation !== 'unknown' && operation !== 'read');
    const set = new Set<WriteOperationKind>(filtered);

    return {
        operations: Array.from(set),
        hasWrite: filtered.some((operation) => WRITE_OPS.has(operation)),
        hasDestructive: filtered.some((operation) => DESTRUCTIVE_OPS.has(operation)),
        hasUpdateNoWhere: false,
        hasDeleteNoWhere: false,
    };
}

function formatOperations(operations: WriteOperationKind[]): string {
    const labels = operations
        .filter((operation) => operation !== 'unknown' && operation !== 'read')
        .map((operation) => operation.toUpperCase());
    return labels.length > 0 ? labels.join(', ') : 'WRITE';
}

function isProductionEnvironment(environmentKey?: string | null): boolean {
    return environmentKey === ENVIRONMENT_KEY.PRODUCTION;
}

export function evaluateWriteSafetyDecision(params: {
    analysis: OperationRiskAnalysis | SqlRiskAnalysis;
    safetyLevel: SafetyLevel;
    environmentKey?: string | null;
    actionLabel?: string;
}): WriteSafetyDecision {
    const { analysis, safetyLevel, environmentKey, actionLabel = 'Run SQL' } = params;
    const noWhereDetected = analysis.hasUpdateNoWhere || analysis.hasDeleteNoWhere;
    const prodDoubleConfirm = isProductionEnvironment(environmentKey) && (analysis.hasDestructive || noWhereDetected);
    const operationSummary = formatOperations(analysis.operations);

    if (!analysis.hasWrite) {
        return {
            action: 'allow',
            title: 'No Write Risk',
            message: 'No write risk detected.',
            description: 'This operation is read-only.',
            confirmLabel: 'Continue',
            requiresDoubleConfirm: false,
            severity: 'primary',
        };
    }

    if (safetyLevel === 'strict' && noWhereDetected) {
        return {
            action: 'block',
            title: 'Blocked by Write Safety',
            message: 'UPDATE/DELETE without WHERE is blocked in strict mode.',
            description: `${actionLabel} was blocked because strict safety does not allow broad updates without WHERE.`,
            confirmLabel: 'Blocked',
            requiresDoubleConfirm: false,
            severity: 'danger',
        };
    }

    if (noWhereDetected) {
        return {
            action: 'confirm',
            title: 'No-WHERE Write Detected',
            message: 'UPDATE/DELETE without WHERE may affect many rows.',
            description: `${actionLabel} includes SQL without WHERE. Review carefully before continuing.`,
            confirmLabel: prodDoubleConfirm ? 'Continue' : 'Run Anyway',
            requiresDoubleConfirm: prodDoubleConfirm,
            severity: 'danger',
        };
    }

    if (analysis.hasDestructive) {
        return {
            action: 'confirm',
            title: 'Confirm Destructive Write',
            message: `Destructive operation detected (${operationSummary}).`,
            description: `${actionLabel} includes destructive SQL and requires explicit confirmation.`,
            confirmLabel: prodDoubleConfirm ? 'Continue' : 'Run',
            requiresDoubleConfirm: prodDoubleConfirm,
            severity: 'danger',
        };
    }

    if (analysis.hasWrite && safetyLevel !== 'relaxed') {
        return {
            action: 'confirm',
            title: 'Confirm Write Operation',
            message: 'Write operation detected.',
            description: `${actionLabel} will modify data.`,
            confirmLabel: 'Run',
            requiresDoubleConfirm: false,
            severity: 'primary',
        };
    }

    return {
        action: 'allow',
        title: 'Write Allowed',
        message: 'Write operation allowed.',
        description: 'The current safety level allows this action.',
        confirmLabel: 'Run',
        requiresDoubleConfirm: false,
        severity: 'primary',
    };
}
