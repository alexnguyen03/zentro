import { shortcutRegistry, type CommandCategory, type CommandId } from './shortcutRegistry';
import { useShortcutStore } from '../stores/shortcutStore';

export { type CommandCategory };

export interface CommandItem {
    id: CommandId;
    label: string;
    category: CommandCategory;
    keybinding?: string;
    action: () => void | Promise<void>;
}

export function buildCommands(): CommandItem[] {
    const bindings = useShortcutStore.getState().bindings;
    return shortcutRegistry.map((item) => ({
        id: item.id,
        label: item.label,
        category: item.category,
        keybinding: bindings[item.id] || item.defaultBinding,
        action: item.action,
    }));
}
