import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useShortcutStore } from './shortcutStore';

vi.mock('../services/settingsService', () => ({
    GetPreferences: vi.fn(async () => ({ shortcuts: {}, shortcut_rules: [] })),
    SetPreferences: vi.fn(async () => undefined),
}));

describe('shortcutStore migration', () => {
    beforeEach(() => {
        useShortcutStore.setState({
            userRules: [],
            effectiveRules: [],
            bindings: {} as any,
            chordStart: null,
            chordUntil: 0,
        } as any);
    });

    it('migrates legacy shortcuts map when shortcut_rules is missing', () => {
        useShortcutStore.getState().loadFromPreferences(
            {
                'editor.newTab': 'Ctrl+Alt+T',
                'layout.toggleSidebar': 'Ctrl+B',
            },
            undefined,
        );

        const state = useShortcutStore.getState();
        expect(state.userRules.some((rule) => rule.commandId === 'editor.newTab')).toBe(true);
        expect(state.userRules.some((rule) => rule.commandId === 'layout.toggleSidebar')).toBe(false);
    });

    it('uses shortcut_rules as source of truth when provided', () => {
        useShortcutStore.getState().loadFromPreferences(
            {
                'editor.newTab': 'Ctrl+T',
            },
            [
                {
                    id: 'u1',
                    command_id: 'editor.newTab',
                    binding: 'Ctrl+Shift+T',
                    when: '',
                    source: 'user',
                    order: 0,
                },
            ] as any,
        );

        const state = useShortcutStore.getState();
        expect(state.bindings['editor.newTab']).toBe('ctrl+shift+t');
        expect(state.userRules).toHaveLength(1);
    });
});
