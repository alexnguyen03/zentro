import * as React from 'react';
import type { LucideIcon } from 'lucide-react';
import type { SidebarSide } from '../../stores/sidebarUiStore';

export interface SidebarPanelDefinition<TState = unknown> {
    id: string;
    side: SidebarSide;
    label: string;
    icon: LucideIcon;
    order: number;
    render: () => React.ReactNode;
    getBadge?: () => string | number | null | undefined;
    defaultState?: TState;
}

interface RegistryStore {
    bySide: Record<SidebarSide, Map<string, SidebarPanelDefinition>>;
    snapshots: Record<SidebarSide, SidebarPanelDefinition[]>;
    listeners: Set<() => void>;
}

const STORE_KEY = '__zentroSidebarPanelRegistry__';

function getRegistryStore(): RegistryStore {
    const host = globalThis as typeof globalThis & {
        [STORE_KEY]?: RegistryStore;
    };
    if (!host[STORE_KEY]) {
        host[STORE_KEY] = {
            bySide: {
                primary: new Map(),
                secondary: new Map(),
            },
            snapshots: {
                primary: [],
                secondary: [],
            },
            listeners: new Set(),
        };
    } else {
        // HMR-safe backfill when the registry shape changes between reloads.
        const existing = host[STORE_KEY]!;
        if (!existing.snapshots) {
            (existing as RegistryStore).snapshots = {
                primary: [],
                secondary: [],
            };
            rebuildSnapshot('primary');
            rebuildSnapshot('secondary');
        }
    }
    return host[STORE_KEY]!;
}

function rebuildSnapshot(side: SidebarSide): void {
    const store = getRegistryStore();
    store.snapshots[side] = Array.from(store.bySide[side].values()).sort((left, right) => {
        if (left.order !== right.order) return left.order - right.order;
        return left.id.localeCompare(right.id);
    });
}

function notifyListeners(): void {
    getRegistryStore().listeners.forEach((listener) => listener());
}

export function registerSidebarPanel(definition: SidebarPanelDefinition, options?: { replace?: boolean }): void {
    const store = getRegistryStore();
    const sideStore = store.bySide[definition.side];
    const existed = sideStore.has(definition.id);

    if (existed && !options?.replace) return;
    sideStore.set(definition.id, definition);
    rebuildSnapshot(definition.side);
    notifyListeners();
}

export function unregisterSidebarPanel(side: SidebarSide, panelId: string): void {
    const store = getRegistryStore();
    const sideStore = store.bySide[side];
    if (!sideStore.delete(panelId)) return;
    rebuildSnapshot(side);
    notifyListeners();
}

export function getSidebarPanels(side: SidebarSide): SidebarPanelDefinition[] {
    return getRegistryStore().snapshots[side];
}

export function subscribeSidebarPanels(listener: () => void): () => void {
    const store = getRegistryStore();
    store.listeners.add(listener);
    return () => {
        store.listeners.delete(listener);
    };
}

export function useSidebarPanels(side: SidebarSide): SidebarPanelDefinition[] {
    return React.useSyncExternalStore(
        subscribeSidebarPanels,
        () => getSidebarPanels(side),
        () => getSidebarPanels(side),
    );
}
