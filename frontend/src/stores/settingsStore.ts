import { create } from 'zustand';
import { GetPreferences, SetPreferences } from '../services/settingsService';
import { utils } from '../../wailsjs/go/models';
import { ToastPlacement } from '../components/layout/Toast';
import { useShortcutStore } from './shortcutStore';

let saveTimeout: ReturnType<typeof window.setTimeout> | null = null;

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
                fontSize: prefs.font_size || 14,
                defaultLimit: prefs.default_limit || 1000,
                toastPlacement: (prefs.toast_placement as ToastPlacement) || 'bottom-left',
                connectTimeout: prefs.connect_timeout || 10,
                queryTimeout: prefs.query_timeout || 60,
                autoCheckUpdates: prefs.auto_check_updates !== false,
                viewMode: prefs.view_mode === true,
            });
            useShortcutStore.getState().loadFromPreferences(prefs.shortcuts);
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
                font_size: prefs.font_size ?? current.font_size ?? state.fontSize,
                default_limit: prefs.default_limit ?? current.default_limit ?? state.defaultLimit,
                chunk_size: prefs.chunk_size ?? current.chunk_size,
                toast_placement: (prefs.toast_placement as ToastPlacement | undefined) ?? (current.toast_placement as ToastPlacement | undefined) ?? state.toastPlacement,
                query_timeout: prefs.query_timeout ?? current.query_timeout ?? state.queryTimeout,
                connect_timeout: prefs.connect_timeout ?? current.connect_timeout ?? state.connectTimeout,
                schema_timeout: prefs.schema_timeout ?? current.schema_timeout,
                auto_check_updates: prefs.auto_check_updates ?? current.auto_check_updates ?? state.autoCheckUpdates,
                view_mode: prefs.view_mode ?? current.view_mode ?? state.viewMode,
                shortcuts: prefs.shortcuts ?? current.shortcuts ?? useShortcutStore.getState().bindings,
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

