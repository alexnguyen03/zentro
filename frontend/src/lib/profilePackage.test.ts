import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildCurrentProfilePackage, parseProfilePackage, applyProfilePackage } from './profilePackage';
import { useSettingsStore } from '../stores/settingsStore';
import { useLayoutStore } from '../stores/layoutStore';
import { useShortcutStore } from '../stores/shortcutStore';

describe('profilePackage', () => {
    beforeEach(() => {
        useSettingsStore.setState({
            theme: 'dark',
            fontSize: 14,
            defaultLimit: 1000,
            toastPlacement: 'bottom-left',
            connectTimeout: 10,
            queryTimeout: 60,
            autoCheckUpdates: true,
            viewMode: false,
        } as any);

        useLayoutStore.setState({
            showSidebar: true,
            showResultPanel: true,
            showRightSidebar: false,
        } as any);

        useShortcutStore.setState({
            bindings: {
                'editor.newTab': 'Ctrl+T',
            },
        } as any);
    });

    it('builds profile package from current stores', () => {
        const profile = buildCurrentProfilePackage('Team SQL');
        expect(profile.schema).toBe('zentro.profile');
        expect(profile.version).toBe(2);
        expect(profile.metadata.name).toBe('Team SQL');
        expect(profile.settings.theme).toBe('dark');
        expect(profile.layout.show_sidebar).toBe(true);
        expect(profile.customization.token_preset_id).toBe('dark');
    });

    it('parses and migrates profile package v1 to v2', () => {
        const raw = JSON.stringify({
            schema: 'zentro.profile',
            version: 1,
            metadata: { name: 'Demo', exported_at: new Date().toISOString() },
            settings: {
                theme: 'light',
                font_size: 13,
                default_limit: 500,
                toast_placement: 'bottom-left',
                connect_timeout: 10,
                query_timeout: 60,
                auto_check_updates: true,
                view_mode: false,
            },
            layout: {
                show_sidebar: true,
                show_result_panel: true,
                show_right_sidebar: false,
            },
            shortcuts: {
                'editor.newTab': 'Ctrl+T',
            },
        });

        const parsed = parseProfilePackage(raw);
        expect(parsed.metadata.name).toBe('Demo');
        expect(parsed.version).toBe(2);
        expect(parsed.shortcuts['editor.newTab']).toBe('Ctrl+T');
        expect(parsed.command_overrides.metadata.source).toBe('migrated-v1');
    });

    it('throws on invalid schema', () => {
        expect(() => parseProfilePackage(JSON.stringify({ schema: 'other', version: 1 }))).toThrow();
    });

    it('applies profile into stores and persistence APIs', async () => {
        const save = vi.fn(async () => undefined);
        const replaceBindings = vi.fn(async () => undefined);
        const setShowSidebar = vi.fn();
        const setShowResultPanel = vi.fn();
        const setShowRightSidebar = vi.fn();

        useSettingsStore.setState({ save } as any);
        useShortcutStore.setState({ replaceBindings } as any);
        useLayoutStore.setState({
            setShowSidebar,
            setShowResultPanel,
            setShowRightSidebar,
        } as any);

        await applyProfilePackage({
            schema: 'zentro.profile',
            version: 1,
            metadata: { name: 'Shared', exported_at: new Date().toISOString() },
            settings: {
                theme: 'light',
                font_size: 16,
                default_limit: 500,
                toast_placement: 'top-right',
                connect_timeout: 15,
                query_timeout: 120,
                auto_check_updates: false,
                view_mode: true,
            },
            layout: {
                show_sidebar: false,
                show_result_panel: false,
                show_right_sidebar: true,
            },
            shortcuts: {
                'editor.newTab': 'Ctrl+Alt+T',
            } as any,
        });

        expect(save).toHaveBeenCalledTimes(1);
        expect(replaceBindings).toHaveBeenCalledTimes(1);
        expect(setShowSidebar).toHaveBeenCalledWith(false);
        expect(setShowResultPanel).toHaveBeenCalledWith(false);
        expect(setShowRightSidebar).toHaveBeenCalledWith(true);
    });
});
