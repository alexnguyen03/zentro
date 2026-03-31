import { describe, expect, it } from 'vitest';
import {
    buildEffectiveRules,
    buildLegacyBindingMirror,
    hasCrossCommandConflict,
    migrateLegacyBindingsToUserRules,
    sanitizeUserRules,
} from './shortcutRules';

describe('shortcutRules', () => {
    it('migrates legacy shortcuts map into explicit user rules (only non-default overrides)', () => {
        const migrated = migrateLegacyBindingsToUserRules({
            'editor.newTab': 'Ctrl+Alt+T',
            'layout.toggleSidebar': 'Ctrl+B',
        });
        const commands = migrated.map((rule) => rule.commandId);
        expect(commands).toContain('editor.newTab');
        expect(commands).not.toContain('layout.toggleSidebar');
    });

    it('builds effective rules and legacy mirror from user overrides', () => {
        const userRules = sanitizeUserRules([
            {
                id: 'u1',
                commandId: 'editor.newTab',
                binding: 'ctrl+alt+t',
                when: '',
                order: 0,
            },
        ]);
        const effective = buildEffectiveRules(userRules);
        const mirror = buildLegacyBindingMirror(userRules);

        expect(effective.find((rule) => rule.commandId === 'editor.newTab')?.source).toBe('user');
        expect(mirror['editor.newTab']).toBe('alt+ctrl+t');
    });

    it('detects cross-command conflict by normalized binding', () => {
        const rules = buildEffectiveRules(sanitizeUserRules([
            { id: 'u1', commandId: 'editor.newTab', binding: 'Ctrl+Alt+T', when: '', order: 0 },
        ]));
        expect(hasCrossCommandConflict(rules, { commandId: 'layout.toggleSidebar', binding: 'ctrl+alt+t' })).toBe('editor.newTab');
    });
});
