import { utils } from '../../wailsjs/go/models';
import { getDefaultShortcutMap, type CommandId } from './shortcutRegistry';
import { migrateLegacyBindingsToUserRules, sanitizeUserRules, type ShortcutRule } from './shortcutRules';
import { useLayoutStore } from '../stores/layoutStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useShortcutStore } from '../stores/shortcutStore';
import type {
    ZentroProfilePackage,
    ZentroProfilePackageV1,
    ZentroProfilePackageV2,
    ZentroProfilePackageV3,
} from '../types/profile';

function sanitizeShortcuts(shortcuts: Record<string, string> | undefined): Record<CommandId, string> {
    const defaultShortcutMap = getDefaultShortcutMap();
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

function sanitizeShortcutRulesFromProfile(shortcutRules: unknown): ShortcutRule[] {
    if (!Array.isArray(shortcutRules)) return [];
    return sanitizeUserRules(
        shortcutRules.map((rule) => {
            const source = rule as Record<string, unknown>;
            return {
                id: typeof source.id === 'string' ? source.id : '',
                commandId: source.command_id as CommandId,
                binding: typeof source.binding === 'string' ? source.binding : '',
                when: typeof source.when === 'string' ? source.when : '',
                source: 'user' as const,
                order: typeof source.order === 'number' ? source.order : 0,
            };
        }),
    );
}

function toProfileShortcutRules(shortcutRules: ShortcutRule[]): ZentroProfilePackageV3['shortcut_rules'] {
    return shortcutRules.map((rule) => ({
        id: rule.id,
        command_id: rule.commandId,
        binding: rule.binding,
        when: rule.when,
        source: 'user',
        order: rule.order,
    }));
}

export function buildCurrentProfilePackage(profileName: string): ZentroProfilePackageV3 {
    const settings = useSettingsStore.getState();
    const layout = useLayoutStore.getState();
    const shortcutState = useShortcutStore.getState();
    const shortcuts = shortcutState.bindings;
    const shortcutRules = shortcutState.userRules;
    const fontFamily = typeof window !== 'undefined'
        ? getComputedStyle(document.documentElement).getPropertyValue('--font-family-sans').trim()
        : '';

    return {
        schema: 'zentro.profile',
        version: 3,
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
        shortcut_rules: toProfileShortcutRules(shortcutRules),
        customization: {
            font_family: fontFamily || undefined,
            token_preset_id: settings.theme || 'system',
            layout_preset_id: 'default',
        },
        command_overrides: {
            metadata: {
                source: 'shortcut-store',
                generated_at: new Date().toISOString(),
            },
        },
    };
}

export function downloadProfilePackage(profile: ZentroProfilePackage): void {
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

function isProfilePackageV2(value: unknown): value is ZentroProfilePackageV2 {
    if (!value || typeof value !== 'object') return false;
    const candidate = value as Record<string, unknown>;
    return candidate.schema === 'zentro.profile' && candidate.version === 2;
}

function isProfilePackageV3(value: unknown): value is ZentroProfilePackageV3 {
    if (!value || typeof value !== 'object') return false;
    const candidate = value as Record<string, unknown>;
    return candidate.schema === 'zentro.profile' && candidate.version === 3;
}

function normalizeProfilePackage(profile: ZentroProfilePackage): ZentroProfilePackageV3 {
    if (profile.version === 3) {
        return {
            ...profile,
            shortcuts: sanitizeShortcuts(profile.shortcuts),
            shortcut_rules: toProfileShortcutRules(sanitizeShortcutRulesFromProfile(profile.shortcut_rules)),
            customization: {
                font_family: profile.customization?.font_family,
                token_preset_id: profile.customization?.token_preset_id || profile.settings.theme || 'system',
                layout_preset_id: profile.customization?.layout_preset_id || 'default',
            },
            command_overrides: {
                metadata: {
                    source: profile.command_overrides?.metadata?.source || 'imported',
                    generated_at: profile.command_overrides?.metadata?.generated_at || new Date().toISOString(),
                },
            },
        };
    }

    if (profile.version === 2) {
        const migratedShortcuts = sanitizeShortcuts(profile.shortcuts);
        const migratedRules = migrateLegacyBindingsToUserRules(migratedShortcuts);
        return {
            ...profile,
            version: 3,
            shortcuts: migratedShortcuts,
            shortcut_rules: toProfileShortcutRules(migratedRules),
            customization: {
                font_family: profile.customization?.font_family,
                token_preset_id: profile.customization?.token_preset_id || profile.settings.theme || 'system',
                layout_preset_id: profile.customization?.layout_preset_id || 'default',
            },
            command_overrides: {
                metadata: {
                    source: profile.command_overrides?.metadata?.source || 'imported',
                    generated_at: profile.command_overrides?.metadata?.generated_at || new Date().toISOString(),
                },
            },
        };
    }

    const migratedShortcuts = sanitizeShortcuts(profile.shortcuts);
    const migratedRules = migrateLegacyBindingsToUserRules(migratedShortcuts);
    return {
        ...profile,
        version: 3,
        shortcuts: migratedShortcuts,
        shortcut_rules: toProfileShortcutRules(migratedRules),
        customization: {
            token_preset_id: profile.settings.theme || 'system',
            layout_preset_id: 'default',
        },
        command_overrides: {
            metadata: {
                source: 'migrated-v1',
                generated_at: new Date().toISOString(),
            },
        },
    };
}

export function parseProfilePackage(raw: string): ZentroProfilePackageV3 {
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        throw new Error('Invalid JSON profile file.');
    }

    if (!isProfilePackageV1(parsed) && !isProfilePackageV2(parsed) && !isProfilePackageV3(parsed)) {
        throw new Error('Unsupported profile schema or version.');
    }

    return normalizeProfilePackage(parsed as ZentroProfilePackage);
}

export async function applyProfilePackage(profile: ZentroProfilePackage): Promise<void> {
    const normalized = normalizeProfilePackage(profile);
    const settings = useSettingsStore.getState();
    const shortcuts = useShortcutStore.getState();
    const layout = useLayoutStore.getState();

    await settings.save(new utils.Preferences({
        theme: normalized.settings.theme,
        font_size: normalized.settings.font_size,
        default_limit: normalized.settings.default_limit,
        toast_placement: normalized.settings.toast_placement,
        connect_timeout: normalized.settings.connect_timeout,
        query_timeout: normalized.settings.query_timeout,
        auto_check_updates: normalized.settings.auto_check_updates,
        view_mode: normalized.settings.view_mode,
        shortcuts: normalized.shortcuts,
        shortcut_rules: normalized.shortcut_rules,
    }));

    await shortcuts.replaceShortcutRules(sanitizeShortcutRulesFromProfile(normalized.shortcut_rules));

    layout.setShowSidebar(Boolean(normalized.layout.show_sidebar));
    layout.setShowResultPanel(Boolean(normalized.layout.show_result_panel));
    layout.setShowRightSidebar(Boolean(normalized.layout.show_right_sidebar));
}
