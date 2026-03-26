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

export interface TelemetryExportBundle {
    exportedAt: string;
    snapshots: QueryPerformanceSnapshot[];
    events: TelemetryEventEnvelope[];
    consent: TelemetryConsentState;
}

const QUERY_SNAPSHOT_KEY = 'zentro:query-performance-snapshots:v1';
const TELEMETRY_EVENTS_KEY = 'zentro:telemetry-events:v1';
const MAX_SNAPSHOTS = 200;
const MAX_EVENTS = 500;

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
    const envelope = {
        event,
        ts: Date.now(),
        payload,
    };
    try {
        const current = loadTelemetryEvents();
        const next = [envelope, ...current].slice(0, MAX_EVENTS);
        localStorage.setItem(TELEMETRY_EVENTS_KEY, JSON.stringify(next));
    } catch {
        // best-effort only
    }
    return envelope;
}

export function loadTelemetryEvents(): TelemetryEventEnvelope[] {
    try {
        const raw = localStorage.getItem(TELEMETRY_EVENTS_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw) as TelemetryEventEnvelope[];
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

export function buildTelemetryExportBundle(consent: TelemetryConsentState): TelemetryExportBundle {
    return {
        exportedAt: new Date().toISOString(),
        snapshots: loadQuerySnapshots(),
        events: loadTelemetryEvents(),
        consent,
    };
}

export function exportTelemetryBundle(bundle: TelemetryExportBundle) {
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    const safeDate = bundle.exportedAt.replace(/[:.]/g, '-');
    anchor.href = url;
    anchor.download = `zentro-telemetry-${safeDate}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
}
