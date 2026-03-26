import { utils } from '../../wailsjs/go/models';
import { defaultShortcutMap, type CommandId } from './shortcutRegistry';
import { useLayoutStore } from '../stores/layoutStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useShortcutStore } from '../stores/shortcutStore';
import type { ZentroProfilePackageV1 } from '../types/profile';

function sanitizeShortcuts(shortcuts: Record<string, string> | undefined): Record<CommandId, string> {
    const next = { ...defaultShortcutMap };
    if (!shortcuts) return next;

    (Object.keys(defaultShortcutMap) as CommandId[]).forEach((id) => {
        const value = shortcuts[id];
        if (typeof value === 'string' && value.trim()) {
            next[id] = value.trim();
        }
    });
    return next;
}

function sanitizeFileName(name: string): string {
    return name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9-_]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'zentro-profile';
}

export function buildCurrentProfilePackage(profileName: string): ZentroProfilePackageV1 {
    const settings = useSettingsStore.getState();
    const layout = useLayoutStore.getState();
    const shortcuts = useShortcutStore.getState().bindings;

    return {
        schema: 'zentro.profile',
        version: 1,
        metadata: {
            name: profileName.trim() || 'Zentro Profile',
            exported_at: new Date().toISOString(),
        },
        settings: {
            theme: settings.theme,
            font_size: settings.fontSize,
            default_limit: settings.defaultLimit,
            toast_placement: settings.toastPlacement,
            connect_timeout: settings.connectTimeout,
            query_timeout: settings.queryTimeout,
            auto_check_updates: settings.autoCheckUpdates,
            view_mode: settings.viewMode,
        },
        layout: {
            show_sidebar: layout.showSidebar,
            show_result_panel: layout.showResultPanel,
            show_right_sidebar: layout.showRightSidebar,
        },
        shortcuts: sanitizeShortcuts(shortcuts),
    };
}

export function downloadProfilePackage(profile: ZentroProfilePackageV1): void {
    const pretty = JSON.stringify(profile, null, 2);
    const blob = new Blob([pretty], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${sanitizeFileName(profile.metadata.name)}.zentro-profile.json`;
    anchor.click();
    URL.revokeObjectURL(url);
}

function isProfilePackageV1(value: unknown): value is ZentroProfilePackageV1 {
    if (!value || typeof value !== 'object') return false;
    const candidate = value as Record<string, unknown>;
    return candidate.schema === 'zentro.profile' && candidate.version === 1;
}

export function parseProfilePackage(raw: string): ZentroProfilePackageV1 {
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        throw new Error('Invalid JSON profile file.');
    }

    if (!isProfilePackageV1(parsed)) {
        throw new Error('Unsupported profile schema or version.');
    }

    const profile = parsed as ZentroProfilePackageV1;
    return {
        ...profile,
        shortcuts: sanitizeShortcuts(profile.shortcuts),
    };
}

export async function applyProfilePackage(profile: ZentroProfilePackageV1): Promise<void> {
    const settings = useSettingsStore.getState();
    const shortcuts = useShortcutStore.getState();
    const layout = useLayoutStore.getState();

    await settings.save(new utils.Preferences({
        theme: profile.settings.theme,
        font_size: profile.settings.font_size,
        default_limit: profile.settings.default_limit,
        toast_placement: profile.settings.toast_placement,
        connect_timeout: profile.settings.connect_timeout,
        query_timeout: profile.settings.query_timeout,
        auto_check_updates: profile.settings.auto_check_updates,
        view_mode: profile.settings.view_mode,
        shortcuts: profile.shortcuts,
    }));

    await shortcuts.replaceBindings(profile.shortcuts);

    layout.setShowSidebar(Boolean(profile.layout.show_sidebar));
    layout.setShowResultPanel(Boolean(profile.layout.show_result_panel));
    layout.setShowRightSidebar(Boolean(profile.layout.show_right_sidebar));
}
