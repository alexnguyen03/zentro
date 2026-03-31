import { create } from 'zustand';
import { GetPreferences, SetPreferences } from '../services/settingsService';
import { utils } from '../../wailsjs/go/models';
import { ToastPlacement } from '../components/layout/Toast';
import { useShortcutStore } from './shortcutStore';

let saveTimeout: ReturnType<typeof window.setTimeout> | null = null;
const DEFAULT_TOAST_PLACEMENT: ToastPlacement = 'bottom-left';
const VALID_TOAST_PLACEMENTS: ToastPlacement[] = [
    'top-left',
    'top-center',
    'top-right',
    'bottom-left',
    'bottom-center',
    'bottom-right',
];

function clampNumber(value: number | undefined, fallback: number, min: number, max: number): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
    return Math.min(max, Math.max(min, Math.round(value)));
}

function normalizeToastPlacement(value: unknown): ToastPlacement {
    if (typeof value === 'string' && VALID_TOAST_PLACEMENTS.includes(value as ToastPlacement)) {
        return value as ToastPlacement;
    }
    return DEFAULT_TOAST_PLACEMENT;
}

interface SettingsState {
    theme: string;
    fontSize: number;
    defaultLimit: number;
    toastPlacement: ToastPlacement;
    connectTimeout: number;
    queryTimeout: number;
    autoCheckUpdates: boolean;
    viewMode: boolean;

    load: () => Promise<void>;
    save: (prefs: utils.Preferences) => Promise<void>;
    setFontSize: (size: number) => void;
    updateFontSize: (delta: number) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
    theme: 'system',
    fontSize: 14,
    defaultLimit: 1000,
    toastPlacement: 'bottom-left',
    connectTimeout: 10,
    queryTimeout: 60,
    autoCheckUpdates: true,
    viewMode: false,

    load: async () => {
        try {
            const prefs = await GetPreferences();
            set({
                theme: prefs.theme || 'system',
                fontSize: clampNumber(prefs.font_size, 14, 8, 48),
                defaultLimit: clampNumber(prefs.default_limit, 1000, 100, 100000),
                toastPlacement: normalizeToastPlacement(prefs.toast_placement),
                connectTimeout: clampNumber(prefs.connect_timeout, 10, 5, 300),
                queryTimeout: clampNumber(prefs.query_timeout, 60, 5, 100000),
                autoCheckUpdates: prefs.auto_check_updates !== false,
                viewMode: prefs.view_mode === true,
            });
            useShortcutStore.getState().loadFromPreferences(prefs.shortcuts, prefs.shortcut_rules);
            // Apply theme
            document.documentElement.setAttribute('data-theme', prefs.theme || 'system');
        } catch (err) {
            console.error('Failed to load preferences:', err);
        }
    },

    save: async (prefs: utils.Preferences) => {
        try {
            const current = await GetPreferences();
            const state = useSettingsStore.getState();
            const merged = new utils.Preferences({
                theme: prefs.theme ?? current.theme ?? state.theme,
                font_size: clampNumber(
                    prefs.font_size ?? current.font_size ?? state.fontSize,
                    state.fontSize,
                    8,
                    48,
                ),
                default_limit: clampNumber(
                    prefs.default_limit ?? current.default_limit ?? state.defaultLimit,
                    state.defaultLimit,
                    100,
                    100000,
                ),
                chunk_size: prefs.chunk_size ?? current.chunk_size,
                toast_placement: normalizeToastPlacement(
                    prefs.toast_placement ?? current.toast_placement ?? state.toastPlacement,
                ),
                query_timeout: clampNumber(
                    prefs.query_timeout ?? current.query_timeout ?? state.queryTimeout,
                    state.queryTimeout,
                    5,
                    100000,
                ),
                connect_timeout: clampNumber(
                    prefs.connect_timeout ?? current.connect_timeout ?? state.connectTimeout,
                    state.connectTimeout,
                    5,
                    300,
                ),
                schema_timeout: prefs.schema_timeout ?? current.schema_timeout,
                auto_check_updates: prefs.auto_check_updates ?? current.auto_check_updates ?? state.autoCheckUpdates,
                view_mode: prefs.view_mode ?? current.view_mode ?? state.viewMode,
                shortcuts: prefs.shortcuts ?? current.shortcuts ?? useShortcutStore.getState().bindings,
                shortcut_rules: prefs.shortcut_rules ?? current.shortcut_rules ?? useShortcutStore.getState().userRules.map((rule) => ({
                    id: rule.id,
                    command_id: rule.commandId,
                    binding: rule.binding,
                    when: rule.when,
                    source: 'user',
                    order: rule.order,
                })),
            });

            await SetPreferences(merged);
            set({
                theme: merged.theme,
                fontSize: merged.font_size,
                defaultLimit: merged.default_limit,
                toastPlacement: merged.toast_placement as ToastPlacement,
                connectTimeout: merged.connect_timeout,
                queryTimeout: merged.query_timeout,
                autoCheckUpdates: merged.auto_check_updates,
                viewMode: merged.view_mode === true,
            });
            // Apply theme
            document.documentElement.setAttribute('data-theme', merged.theme);
        } catch (err) {
            console.error('Failed to save preferences:', err);
        }
    },

    setFontSize: (size: number) => {
        const newSize = Math.max(8, Math.min(48, size));
        set({ fontSize: newSize });
        
        // Persist after a short delay (debounce)
        if (saveTimeout) clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => {
            const state = useSettingsStore.getState();
            state.save(new utils.Preferences({
                font_size: state.fontSize,
            })).catch(err => console.error('Failed to auto-save font size:', err));
        }, 1000);
    },

    updateFontSize: (delta: number) => {
        const { fontSize, setFontSize } = useSettingsStore.getState();
        setFontSize(fontSize + delta);
    },
}));

