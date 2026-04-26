export type PluginCapability =
    | 'ui.commands'
    | 'ui.menu'
    | 'data.providers';

export type PluginCommandCategory = 'Editor' | 'Layout' | 'Connection' | 'View' | 'App';

export interface PluginMenuItem {
    id: string;
    label: string;
    shortcut?: string;
    disabled?: boolean;
    danger?: boolean;
    hasBadge?: boolean;
    action: () => void | Promise<void>;
}

export interface PluginManifest {
    id: string;
    version: string;
    minAppVersion: string;
    capabilities: PluginCapability[];
}

export interface PluginCommandContribution {
    id: `ext.${string}`;
    title: string;
    category: PluginCommandCategory;
    defaultBinding: string;
    defaultWhen?: string;
    handlerKey: string;
}

export interface PluginDataProviderContribution {
    id: string;
    resourceTypes: string[];
    queryHook: string;
}

export interface PluginMenuContribution {
    sectionId: string;
    sectionTitle?: string;
    item: PluginMenuItem;
}

export interface PluginContribution {
    manifest: PluginManifest;
    commands?: PluginCommandContribution[];
    dataProviders?: PluginDataProviderContribution[];
    menus?: PluginMenuContribution[];
}

export interface ResolvedPluginCommand {
    pluginId: string;
    entry: {
        id: `ext.${string}`;
        label: string;
        category: PluginCommandCategory;
        defaultBinding: string;
        defaultWhen?: string;
        action: () => void | Promise<void>;
    };
}
