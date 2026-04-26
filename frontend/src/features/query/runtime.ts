export type QueryExecutionState =
    | 'queued'
    | 'running'
    | 'streaming'
    | 'done'
    | 'cancelled'
    | 'failed';

export type QueryFailureCode =
    | 'none'
    | 'syntax'
    | 'network'
    | 'permission'
    | 'timeout'
    | 'cancelled'
    | 'unknown';

export interface QueryProgress {
    startedAt: number;
    firstRowAt?: number;
    lastChunkAt?: number;
    rowsReceived: number;
    chunksReceived: number;
}

export interface QueryPolicy {
    queryTimeoutSeconds: number;
    rowCapPerTab: number;
    requireWriteConfirm: boolean;
    destructiveRules: 'prompt' | 'block';
    environmentStrictness: 'normal' | 'strict';
    safetyLevel: 'strict' | 'balanced' | 'relaxed';
    requireProdDoubleConfirm: boolean;
    strongConfirmFromEnvironment: string;
}

export interface ExecutionPolicy {
    timeoutSeconds: number;
    rowCapPerTab: number;
    destructiveRules: 'prompt' | 'block';
    environmentStrictness: 'normal' | 'strict';
    safetyLevel: 'strict' | 'balanced' | 'relaxed';
    requireProdDoubleConfirm: boolean;
}

export function classifyQueryFailure(errorMessage?: string): QueryFailureCode {
    if (!errorMessage) return 'none';
    const raw = errorMessage.toLowerCase();
    if (raw.includes('cancel')) return 'cancelled';
    if (raw.includes('timeout') || raw.includes('deadline exceeded')) return 'timeout';
    if (raw.includes('permission') || raw.includes('denied') || raw.includes('forbidden')) return 'permission';
    if (raw.includes('syntax') || raw.includes('parse')) return 'syntax';
    if (raw.includes('network') || raw.includes('connection') || raw.includes('socket')) return 'network';
    return 'unknown';
}
