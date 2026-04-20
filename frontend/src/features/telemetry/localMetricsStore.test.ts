import { beforeEach, describe, expect, it } from 'vitest';
import {
    loadTelemetryAnalyticsOutbox,
    queueTelemetryAnalytics,
} from './localMetricsStore';
import type { TelemetryConsentState } from './contracts';

describe('localMetricsStore analytics pipeline', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('skips analytics queue when consent is not opted-in', () => {
        const consent: TelemetryConsentState = {
            optedIn: false,
            lastUpdatedAt: 0,
            source: 'default',
        };
        const queued = queueTelemetryAnalytics('query.done', { tabId: 'tab-1', durationMs: 120 }, consent);
        expect(queued).toBeNull();
    });

    it('stores anonymized analytics payload when opted-in', () => {
        const consent: TelemetryConsentState = {
            optedIn: true,
            lastUpdatedAt: 100,
            source: 'user',
        };
        const queued = queueTelemetryAnalytics(
            'query.done',
            { tabId: 'tab-1', sourceTabId: 'source-1', durationMs: 120, failed: false },
            consent,
        );
        expect(queued).not.toBeNull();
        expect(queued?.payload.tabId).toMatch(/\[redacted:/);
        expect(queued?.payload.durationMs).toBe(120);

        const outbox = loadTelemetryAnalyticsOutbox();
        expect(outbox.length).toBe(1);
        expect(outbox[0].event).toBe('query.done');
    });
});

