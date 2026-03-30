export interface TelemetryConsentState {
    optedIn: boolean;
    lastUpdatedAt: number;
    source?: 'user' | 'migration' | 'default';
}

export interface TelemetryEventEnvelope {
    event: string;
    ts: number;
    payload: Record<string, unknown>;
}

export interface TelemetryAnalyticsEnvelope {
    event: string;
    ts: number;
    schemaVersion: number;
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

export interface TelemetryPipelineExportBundle extends TelemetryExportBundle {
    analyticsOutbox: TelemetryAnalyticsEnvelope[];
}
