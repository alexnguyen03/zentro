import { create } from 'zustand';
import { GetPreferences, SetPreferences } from '../../wailsjs/go/app/App';
import { utils } from '../../wailsjs/go/models';
import { ToastPlacement } from '../components/layout/Toast';

interface SettingsState {
    theme: string;
    fontSize: number;
    defaultLimit: number;
    toastPlacement: ToastPlacement;
    isOpen: boolean;

    load: () => Promise<void>;
    save: (prefs: utils.Preferences) => Promise<void>;
    openModal: () => void;
    closeModal: () => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
    theme: 'system',
    fontSize: 14,
    defaultLimit: 1000,
    toastPlacement: 'bottom-left',
    isOpen: false,

    load: async () => {
        try {
            const prefs = await GetPreferences();
            set({
                theme: prefs.theme || 'system',
                fontSize: prefs.font_size || 14,
                defaultLimit: prefs.default_limit || 1000,
                toastPlacement: (prefs.toast_placement as ToastPlacement) || 'bottom-left',
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
                isOpen: false
            });
            // Apply theme
            document.documentElement.setAttribute('data-theme', prefs.theme);
        } catch (err) {
            console.error('Failed to save preferences:', err);
        }
    },

    openModal: () => set({ isOpen: true }),
    closeModal: () => set({ isOpen: false }),
}));
