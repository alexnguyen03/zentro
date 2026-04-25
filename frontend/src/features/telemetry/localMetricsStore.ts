import { STORAGE_KEY } from '../../lib/constants';
import type {
    QueryPerformanceSnapshot,
    TelemetryAnalyticsEnvelope,
    TelemetryConsentState,
    TelemetryEventEnvelope,
} from './contracts';

const MAX_SNAPSHOTS = 200;
const MAX_EVENTS = 500;

export function saveQuerySnapshot(snapshot: QueryPerformanceSnapshot) {
    try {
        const current = loadQuerySnapshots();
        const next = [snapshot, ...current].slice(0, MAX_SNAPSHOTS);
        localStorage.setItem(STORAGE_KEY.QUERY_PERFORMANCE_SNAPSHOTS, JSON.stringify(next));
    } catch {
        // best-effort only
    }
}

export function loadQuerySnapshots(): QueryPerformanceSnapshot[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY.QUERY_PERFORMANCE_SNAPSHOTS);
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
        localStorage.setItem(STORAGE_KEY.TELEMETRY_EVENTS, JSON.stringify(next));
    } catch {
        // best-effort only
    }
    return envelope;
}

function shouldRedactKey(key: string): boolean {
    return /(tab|source|profile|database|db|query|sql|table|schema|session|token|host|user|id)$/i.test(key);
}

function anonymizePayload(payload: Record<string, unknown>): Record<string, unknown> {
    return Object.entries(payload).reduce<Record<string, unknown>>((acc, [key, value]) => {
        if (value == null) {
            acc[key] = value;
            return acc;
        }
        if (typeof value === 'number' || typeof value === 'boolean') {
            acc[key] = value;
            return acc;
        }
        if (typeof value === 'string') {
            acc[key] = shouldRedactKey(key) ? `[redacted:${value.length}]` : value;
            return acc;
        }
        if (Array.isArray(value)) {
            acc[key] = value.length;
            return acc;
        }
        if (typeof value === 'object') {
            acc[key] = '[redacted:object]';
            return acc;
        }
        acc[key] = String(value);
        return acc;
    }, {});
}

export function queueTelemetryAnalytics(
    event: string,
    payload: Record<string, unknown>,
    consent: TelemetryConsentState,
): TelemetryAnalyticsEnvelope | null {
    if (!consent.optedIn) return null;
    const envelope: TelemetryAnalyticsEnvelope = {
        event,
        ts: Date.now(),
        schemaVersion: 1,
        payload: anonymizePayload(payload),
    };
    try {
        const current = loadTelemetryAnalyticsOutbox();
        const next = [envelope, ...current].slice(0, MAX_EVENTS);
        localStorage.setItem(STORAGE_KEY.TELEMETRY_ANALYTICS_OUTBOX, JSON.stringify(next));
    } catch {
        // best-effort only
    }
    return envelope;
}

export function loadTelemetryEvents(): TelemetryEventEnvelope[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY.TELEMETRY_EVENTS);
        if (!raw) return [];
        const parsed = JSON.parse(raw) as TelemetryEventEnvelope[];
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

export function loadTelemetryAnalyticsOutbox(): TelemetryAnalyticsEnvelope[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY.TELEMETRY_ANALYTICS_OUTBOX);
        if (!raw) return [];
        const parsed = JSON.parse(raw) as TelemetryAnalyticsEnvelope[];
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}
