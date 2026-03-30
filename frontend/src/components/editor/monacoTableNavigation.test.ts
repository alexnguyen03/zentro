import { describe, expect, it, vi } from 'vitest';
import { runCtrlClickTableNavigation } from './monacoTableNavigation';

function createModel(text: string) {
    return {
        getValue: () => text,
        getOffsetAt: () => 14,
    };
}

describe('runCtrlClickTableNavigation', () => {
    it('opens table directly when a single match exists', () => {
        const onOpenTable = vi.fn();
        const onShowHint = vi.fn();
        const onShowPicker = vi.fn();

        const result = runCtrlClickTableNavigation({
            model: createModel('SELECT * FROM orders'),
            position: { lineNumber: 1, column: 15 },
            profile: { name: 'dev', db_name: 'app' },
            trees: {
                'dev:app': [
                    { Name: 'public', Tables: ['orders'], Views: [] },
                ],
            },
            onOpenTable,
            onShowHint,
            onShowPicker,
        });

        expect(result).toBe('navigated');
        expect(onOpenTable).toHaveBeenCalledTimes(1);
        expect(onShowHint).not.toHaveBeenCalled();
        expect(onShowPicker).not.toHaveBeenCalled();
    });

    it('shows hint when table is not found', () => {
        const onOpenTable = vi.fn();
        const onShowHint = vi.fn();
        const onShowPicker = vi.fn();

        const result = runCtrlClickTableNavigation({
            model: createModel('SELECT * FROM missing_table'),
            position: { lineNumber: 1, column: 15 },
            profile: { name: 'dev', db_name: 'app' },
            trees: {
                'dev:app': [
                    { Name: 'public', Tables: ['orders'], Views: [] },
                ],
            },
            onOpenTable,
            onShowHint,
            onShowPicker,
        });

        expect(result).toBe('hint');
        expect(onOpenTable).not.toHaveBeenCalled();
        expect(onShowHint).toHaveBeenCalledTimes(1);
        expect(onShowPicker).not.toHaveBeenCalled();
    });

    it('shows picker when there are multiple matches', () => {
        const onOpenTable = vi.fn();
        const onShowHint = vi.fn();
        const onShowPicker = vi.fn();

        const result = runCtrlClickTableNavigation({
            model: createModel('SELECT * FROM users'),
            position: { lineNumber: 1, column: 15 },
            profile: { name: 'dev', db_name: 'app' },
            trees: {
                'dev:app': [
                    { Name: 'public', Tables: ['users'], Views: [] },
                    { Name: 'audit', Tables: ['users'], Views: [] },
                ],
            },
            onOpenTable,
            onShowHint,
            onShowPicker,
        });

        expect(result).toBe('picker');
        expect(onOpenTable).not.toHaveBeenCalled();
        expect(onShowHint).not.toHaveBeenCalled();
        expect(onShowPicker).toHaveBeenCalledTimes(1);
    });
});
