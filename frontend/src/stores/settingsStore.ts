import { create } from 'zustand';
import { GetPreferences, SetPreferences } from '../../wailsjs/go/app/App';
import { utils } from '../../wailsjs/go/models';
import { ToastPlacement } from '../components/layout/Toast';

let saveTimeout: any = null;

interface SettingsState {
    theme: string;
    fontSize: number;
    defaultLimit: number;
    toastPlacement: ToastPlacement;
    connectTimeout: number;
    queryTimeout: number;
    autoCheckUpdates: boolean;

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
            });
            // Apply theme
            document.documentElement.setAttribute('data-theme', prefs.theme || 'system');
        } catch (err) {
            console.error('Failed to load preferences:', err);
        }
    },

    save: async (prefs: utils.Preferences) => {
        try {
            await SetPreferences(prefs);
            set({
                theme: prefs.theme,
                fontSize: prefs.font_size,
                defaultLimit: prefs.default_limit,
                toastPlacement: prefs.toast_placement as ToastPlacement,
                connectTimeout: prefs.connect_timeout,
                queryTimeout: prefs.query_timeout,
                autoCheckUpdates: prefs.auto_check_updates,
            });
            // Apply theme
            document.documentElement.setAttribute('data-theme', prefs.theme);
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
            const prefs = new utils.Preferences({
                theme: state.theme,
                font_size: state.fontSize,
                default_limit: state.defaultLimit,
                toast_placement: state.toastPlacement,
                connect_timeout: state.connectTimeout,
                query_timeout: state.queryTimeout,
                auto_check_updates: state.autoCheckUpdates
            });
            SetPreferences(prefs).catch(err => console.error('Failed to auto-save font size:', err));
        }, 1000);
    },

    updateFontSize: (delta: number) => {
        const { fontSize, setFontSize } = useSettingsStore.getState();
        setFontSize(fontSize + delta);
    },
}));
