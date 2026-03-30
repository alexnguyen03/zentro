import { beforeEach, describe, expect, it } from 'vitest';
import { STORAGE_KEY } from '../../lib/constants';
import { recoverStartupState } from './startupRecovery';

describe('startupRecovery', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('removes unreadable corrupted payload', () => {
        localStorage.setItem(STORAGE_KEY.EDITOR_SESSION, '{broken');
        const report = recoverStartupState();
        expect(report.recoveredKeys).toContain(STORAGE_KEY.EDITOR_SESSION);
        expect(localStorage.getItem(STORAGE_KEY.EDITOR_SESSION)).toBeNull();
    });

    it('keeps valid JSON payload', () => {
        localStorage.setItem(STORAGE_KEY.LAYOUT_STORE, JSON.stringify({ state: { panel: true }, version: 1 }));
        const report = recoverStartupState();
        expect(report.recoveredKeys).toHaveLength(0);
    });

    it('removes known legacy keys', () => {
        localStorage.setItem('zentro:connection-store-v2', JSON.stringify({ activeProfile: 'legacy' }));
        const report = recoverStartupState();
        expect(report.recoveredKeys).toContain('zentro:connection-store-v2');
        expect(localStorage.getItem('zentro:connection-store-v2')).toBeNull();
    });
});
