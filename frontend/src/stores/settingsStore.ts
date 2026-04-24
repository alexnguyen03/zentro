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

export type DensityLevel = 'compact' | 'comfortable' | 'spacious';

export const FONT_PRESETS: Record<string, string> = {
    system: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    inter: '"Inter", "Segoe UI", Roboto, sans-serif',
};

export const MONO_PRESETS: Record<string, string> = {
    cascadia: '"Cascadia Code", "Fira Code", monospace',
    firaCode: '"Fira Code", "JetBrains Mono", monospace',
    jetbrains: '"JetBrains Mono", "Cascadia Code", monospace',
    consolas: '"Consolas", "Courier New", monospace',
};

const VALID_DENSITIES: DensityLevel[] = ['compact', 'comfortable', 'spacious'];

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

function normalizeDensity(value: unknown): DensityLevel {
    if (typeof value === 'string' && VALID_DENSITIES.includes(value as DensityLevel)) {
        return value as DensityLevel;
    }
    return 'compact';
}

export function applyThemeToDOM(prefs: {
    theme?: string;
    density?: DensityLevel;
    accentColor?: string;
    fontFamily?: string;
    monoFamily?: string;
}) {
    const root = document.documentElement;

    // Theme
    root.setAttribute('data-theme', prefs.theme ?? 'system');

    // Density — compact = no attribute (uses :root defaults)
    const density = prefs.density ?? 'compact';
    if (density === 'compact') {
        root.removeAttribute('data-density');
    } else {
        root.setAttribute('data-density', density);
    }

    // Accent color
    if (prefs.accentColor) {
        root.style.setProperty('--user-accent', prefs.accentColor);
    } else {
        root.style.removeProperty('--user-accent');
    }

    // Font families
    if (prefs.fontFamily && FONT_PRESETS[prefs.fontFamily]) {
        root.style.setProperty('--user-font-sans', FONT_PRESETS[prefs.fontFamily]);
    } else {
        root.style.removeProperty('--user-font-sans');
    }
    if (prefs.monoFamily && MONO_PRESETS[prefs.monoFamily]) {
        root.style.setProperty('--user-font-mono', MONO_PRESETS[prefs.monoFamily]);
    } else {
        root.style.removeProperty('--user-font-mono');
    }
}

interface SettingsState {
    theme: string;
    fontSize: number;
    fontFamily: string;
    monoFamily: string;
    accentColor: string;
    density: DensityLevel;
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
    fontFamily: 'system',
    monoFamily: 'cascadia',
    accentColor: '',
    density: 'compact',
    defaultLimit: 1000,
    toastPlacement: 'bottom-left',
    connectTimeout: 10,
    queryTimeout: 60,
    autoCheckUpdates: true,
    viewMode: false,

    load: async () => {
        try {
            const prefs = await GetPreferences();
            const fontSize = clampNumber(prefs.font_size, 14, 8, 48);
            const theme = prefs.theme || 'system';
            // New fields — backend may not have them yet, use defaults
            const fontFamily = (prefs as any).font_family || 'system';
            const monoFamily = (prefs as any).mono_family || 'cascadia';
            const accentColor = (prefs as any).accent_color || '';
            const density = normalizeDensity((prefs as any).density);

            set({
                theme,
                fontSize,
                fontFamily,
                monoFamily,
                accentColor,
                density,
                defaultLimit: clampNumber(prefs.default_limit, 1000, 100, 100000),
                toastPlacement: normalizeToastPlacement(prefs.toast_placement),
                connectTimeout: clampNumber(prefs.connect_timeout, 10, 5, 300),
                queryTimeout: clampNumber(prefs.query_timeout, 60, 5, 100000),
                autoCheckUpdates: prefs.auto_check_updates !== false,
                viewMode: prefs.view_mode === true,
            });
            useShortcutStore.getState().loadFromPreferences(prefs.shortcuts, prefs.shortcut_rules);
            applyThemeToDOM({ theme, fontFamily, monoFamily, accentColor, density });
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
                // New theme fields — passed through via any until model regenerated
                ...(prefs as any).font_family !== undefined ? { font_family: (prefs as any).font_family } : {},
                ...(prefs as any).mono_family !== undefined ? { mono_family: (prefs as any).mono_family } : {},
                ...(prefs as any).accent_color !== undefined ? { accent_color: (prefs as any).accent_color } : {},
                ...(prefs as any).density !== undefined ? { density: (prefs as any).density } : {},
            });

            // Resolve new fields with fallback chain
            const fontFamily = (prefs as any).font_family ?? (current as any).font_family ?? state.fontFamily;
            const monoFamily = (prefs as any).mono_family ?? (current as any).mono_family ?? state.monoFamily;
            const accentColor = (prefs as any).accent_color ?? (current as any).accent_color ?? state.accentColor;
            const density = normalizeDensity((prefs as any).density ?? (current as any).density ?? state.density);

            await SetPreferences(merged);
            set({
                theme: merged.theme,
                fontSize: merged.font_size,
                fontFamily,
                monoFamily,
                accentColor,
                density,
                defaultLimit: merged.default_limit,
                toastPlacement: merged.toast_placement as ToastPlacement,
                connectTimeout: merged.connect_timeout,
                queryTimeout: merged.query_timeout,
                autoCheckUpdates: merged.auto_check_updates,
                viewMode: merged.view_mode === true,
            });
            applyThemeToDOM({ theme: merged.theme, fontFamily, monoFamily, accentColor, density });
        } catch (err) {
            console.error('Failed to save preferences:', err);
        }
    },

    setFontSize: (size: number) => {
        const newSize = Math.max(8, Math.min(48, size));
        set({ fontSize: newSize });

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
