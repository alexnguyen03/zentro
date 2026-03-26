export interface TelemetryConsentState {
    optedIn: boolean;
    lastUpdatedAt: number;
}

export interface TelemetryEventEnvelope {
    event: string;
    ts: number;
    payload: Record<string, unknown>;
}

export interface QueryPerformanceSnapshot {
    tabId: string;
    sourceTabId: string;
    startedAt: number;
    firstRowLatencyMs?: number;
    totalDurationMs?: number;
    rowsReceived: number;
    failureCode: string;
}

const QUERY_SNAPSHOT_KEY = 'zentro:query-performance-snapshots:v1';
const MAX_SNAPSHOTS = 200;

export function saveQuerySnapshot(snapshot: QueryPerformanceSnapshot) {
    try {
        const current = loadQuerySnapshots();
        const next = [snapshot, ...current].slice(0, MAX_SNAPSHOTS);
        localStorage.setItem(QUERY_SNAPSHOT_KEY, JSON.stringify(next));
    } catch {
        // best-effort only
    }
}

export function loadQuerySnapshots(): QueryPerformanceSnapshot[] {
    try {
        const raw = localStorage.getItem(QUERY_SNAPSHOT_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw) as QueryPerformanceSnapshot[];
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

export function toTelemetryEvent(event: string, payload: Record<string, unknown>): TelemetryEventEnvelope {
    return {
        event,
        ts: Date.now(),
        payload,
    };
}

