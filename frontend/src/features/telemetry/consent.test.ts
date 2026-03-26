import { describe, expect, it } from 'vitest';
import { getTelemetryConsent, setTelemetryConsent } from './consent';

describe('telemetry consent', () => {
    it('persists consent flag', () => {
        const updated = setTelemetryConsent(true);
        expect(updated.optedIn).toBe(true);
        expect(getTelemetryConsent().optedIn).toBe(true);
    });
});

