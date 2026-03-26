import { beforeEach, describe, expect, it } from 'vitest';
import { recoverStartupState } from './startupRecovery';

describe('startupRecovery', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('removes unreadable corrupted payload', () => {
        localStorage.setItem('zentro:editor-session-v4', '{broken');
        const report = recoverStartupState();
        expect(report.recoveredKeys).toContain('zentro:editor-session-v4');
        expect(localStorage.getItem('zentro:editor-session-v4')).toBeNull();
    });

    it('keeps valid JSON payload', () => {
        localStorage.setItem('zentro:layout-store-v2', JSON.stringify({ state: { panel: true }, version: 1 }));
        const report = recoverStartupState();
        expect(report.recoveredKeys).toHaveLength(0);
    });
});

