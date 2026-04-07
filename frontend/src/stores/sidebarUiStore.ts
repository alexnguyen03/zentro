import * as React from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { STORAGE_KEY } from '../lib/constants';
import { useEnvironmentStore } from './environmentStore';
import { useProjectStore } from './projectStore';

export type SidebarSide = 'primary' | 'secondary';

export interface SidebarSideState {
    activePanelId: string;
    width: number;
    panelStateByPanelId: Record<string, unknown>;
}

export interface SidebarContextState {
    primary: SidebarSideState;
    secondary: SidebarSideState;
}

type SidebarContextDefaults = {
    primary?: Partial<SidebarSideState>;
    secondary?: Partial<SidebarSideState>;
};

interface SidebarUiStoreState {
    contextStates: Record<string, SidebarContextState>;
    ensureContextState: (contextKey: string, defaults?: SidebarContextDefaults) => void;
    setActivePanel: (contextKey: string, side: SidebarSide, panelId: string) => void;
    setWidth: (contextKey: string, side: SidebarSide, width: number) => void;
    ensurePanelState: <T>(contextKey: string, side: SidebarSide, panelId: string, defaultState: T) => void;
    setPanelState: <T>(contextKey: string, side: SidebarSide, panelId: string, value: T) => void;
}

const MIN_WIDTH_BY_SIDE: Record<SidebarSide, number> = {
    primary: 180,
    secondary: 220,
};

const MAX_WIDTH_BY_SIDE: Record<SidebarSide, number> = {
    primary: 800,
    secondary: 1000,
};

const DEFAULT_STATE_BY_SIDE: Record<SidebarSide, SidebarSideState> = {
    primary: {
        activePanelId: 'explorer',
        width: 250,
        panelStateByPanelId: {},
    },
    secondary: {
        activePanelId: 'detail',
        width: 300,
        panelStateByPanelId: {},
    },
};

function clampWidth(side: SidebarSide, width: number): number {
    if (!Number.isFinite(width)) return DEFAULT_STATE_BY_SIDE[side].width;
    return Math.max(MIN_WIDTH_BY_SIDE[side], Math.min(MAX_WIDTH_BY_SIDE[side], Math.round(width)));
}

function buildSideState(side: SidebarSide, overrides?: Partial<SidebarSideState>): SidebarSideState {
    const base = DEFAULT_STATE_BY_SIDE[side];
    return {
        activePanelId: overrides?.activePanelId || base.activePanelId,
        width: clampWidth(side, overrides?.width ?? base.width),
        panelStateByPanelId: overrides?.panelStateByPanelId || base.panelStateByPanelId,
    };
}

function buildDefaultContextState(defaults?: SidebarContextDefaults): SidebarContextState {
    return {
        primary: buildSideState('primary', defaults?.primary),
        secondary: buildSideState('secondary', defaults?.secondary),
    };
}

function mergeContextDefaults(current: SidebarContextState, defaults?: SidebarContextDefaults): SidebarContextState {
    if (!defaults) return current;

    const nextPrimaryActivePanelId = defaults.primary?.activePanelId ?? current.primary.activePanelId;
    const nextPrimaryWidth = clampWidth('primary', defaults.primary?.width ?? current.primary.width);
    const nextSecondaryActivePanelId = defaults.secondary?.activePanelId ?? current.secondary.activePanelId;
    const nextSecondaryWidth = clampWidth('secondary', defaults.secondary?.width ?? current.secondary.width);

    const primaryChanged =
        nextPrimaryActivePanelId !== current.primary.activePanelId ||
        nextPrimaryWidth !== current.primary.width;
    const secondaryChanged =
        nextSecondaryActivePanelId !== current.secondary.activePanelId ||
        nextSecondaryWidth !== current.secondary.width;

    if (!primaryChanged && !secondaryChanged) return current;

    return {
        primary: primaryChanged
            ? {
                ...current.primary,
                activePanelId: nextPrimaryActivePanelId,
                width: nextPrimaryWidth,
            }
            : current.primary,
        secondary: secondaryChanged
            ? {
                ...current.secondary,
                activePanelId: nextSecondaryActivePanelId,
                width: nextSecondaryWidth,
            }
            : current.secondary,
    };
}

export function buildSidebarContextKey(projectId?: string | null, environmentKey?: string | null): string {
    const safeProjectId = projectId?.trim() || '__global__';
    const safeEnvironmentKey = environmentKey?.trim() || '__default__';
    return `${safeProjectId}::${safeEnvironmentKey}`;
}

export const useSidebarUiStore = create<SidebarUiStoreState>()(
    persist(
        (set, get) => ({
            contextStates: {},
            ensureContextState: (contextKey, defaults) => set((state) => {
                const current = state.contextStates[contextKey];
                if (!current) {
                    return {
                        contextStates: {
                            ...state.contextStates,
                            [contextKey]: buildDefaultContextState(defaults),
                        },
                    };
                }
                const merged = mergeContextDefaults(current, defaults);
                if (merged === current) return state;
                return {
                    contextStates: {
                        ...state.contextStates,
                        [contextKey]: merged,
                    },
                };
            }),
            setActivePanel: (contextKey, side, panelId) => {
                if (!panelId) return;
                get().ensureContextState(contextKey);
                set((state) => {
                    const contextState = state.contextStates[contextKey];
                    if (!contextState) return state;
                    const sideState = contextState[side];
                    if (sideState.activePanelId === panelId) return state;
                    return {
                        contextStates: {
                            ...state.contextStates,
                            [contextKey]: {
                                ...contextState,
                                [side]: {
                                    ...sideState,
                                    activePanelId: panelId,
                                },
                            },
                        },
                    };
                });
            },
            setWidth: (contextKey, side, width) => {
                get().ensureContextState(contextKey);
                const nextWidth = clampWidth(side, width);
                set((state) => {
                    const contextState = state.contextStates[contextKey];
                    if (!contextState) return state;
                    if (contextState[side].width === nextWidth) return state;
                    return {
                        contextStates: {
                            ...state.contextStates,
                            [contextKey]: {
                                ...contextState,
                                [side]: {
                                    ...contextState[side],
                                    width: nextWidth,
                                },
                            },
                        },
                    };
                });
            },
            ensurePanelState: (contextKey, side, panelId, defaultState) => {
                if (!panelId) return;
                get().ensureContextState(contextKey);
                set((state) => {
                    const contextState = state.contextStates[contextKey];
                    if (!contextState) return state;
                    const sideState = contextState[side];
                    if (sideState.panelStateByPanelId[panelId] !== undefined) return state;
                    return {
                        contextStates: {
                            ...state.contextStates,
                            [contextKey]: {
                                ...contextState,
                                [side]: {
                                    ...sideState,
                                    panelStateByPanelId: {
                                        ...sideState.panelStateByPanelId,
                                        [panelId]: defaultState,
                                    },
                                },
                            },
                        },
                    };
                });
            },
            setPanelState: (contextKey, side, panelId, value) => {
                if (!panelId) return;
                get().ensureContextState(contextKey);
                set((state) => {
                    const contextState = state.contextStates[contextKey];
                    if (!contextState) return state;
                    const sideState = contextState[side];
                    return {
                        contextStates: {
                            ...state.contextStates,
                            [contextKey]: {
                                ...contextState,
                                [side]: {
                                    ...sideState,
                                    panelStateByPanelId: {
                                        ...sideState.panelStateByPanelId,
                                        [panelId]: value,
                                    },
                                },
                            },
                        },
                    };
                });
            },
        }),
        {
            name: STORAGE_KEY.SIDEBAR_UI,
            partialize: (state) => ({
                contextStates: state.contextStates,
            }),
        },
    ),
);

export function useSidebarContextKey(): string {
    const activeProjectId = useProjectStore((state) => state.activeProject?.id || null);
    const defaultEnvironmentKey = useProjectStore((state) => state.activeProject?.default_environment_key || null);
    const activeEnvironmentKey = useEnvironmentStore((state) => state.activeEnvironmentKey || null);
    return React.useMemo(
        () => buildSidebarContextKey(activeProjectId, activeEnvironmentKey || defaultEnvironmentKey),
        [activeEnvironmentKey, activeProjectId, defaultEnvironmentKey],
    );
}

export function useSidebarSideState(
    side: SidebarSide,
    defaults?: { activePanelId?: string; width?: number },
) {
    const contextKey = useSidebarContextKey();
    const ensureContextState = useSidebarUiStore((state) => state.ensureContextState);
    const setActivePanel = useSidebarUiStore((state) => state.setActivePanel);
    const setWidth = useSidebarUiStore((state) => state.setWidth);
    const sideState = useSidebarUiStore((state) => state.contextStates[contextKey]?.[side]);

    React.useEffect(() => {
        ensureContextState(contextKey, {
            [side]: {
                activePanelId: defaults?.activePanelId,
                width: defaults?.width,
            },
        });
    }, [contextKey, defaults?.activePanelId, defaults?.width, ensureContextState, side]);

    const activePanelId = sideState?.activePanelId || defaults?.activePanelId || DEFAULT_STATE_BY_SIDE[side].activePanelId;
    const width = sideState?.width ?? defaults?.width ?? DEFAULT_STATE_BY_SIDE[side].width;
    const setActivePanelId = React.useCallback((panelId: string) => {
        setActivePanel(contextKey, side, panelId);
    }, [contextKey, setActivePanel, side]);
    const setSideWidth = React.useCallback((nextWidth: number) => {
        setWidth(contextKey, side, nextWidth);
    }, [contextKey, setWidth, side]);

    return {
        contextKey,
        activePanelId,
        width,
        setActivePanelId,
        setWidth: setSideWidth,
    };
}

export function useSidebarPanelState<T>(
    side: SidebarSide,
    panelId: string,
    defaultState: T,
): [T, (value: React.SetStateAction<T>) => void] {
    const contextKey = useSidebarContextKey();
    const ensurePanelState = useSidebarUiStore((state) => state.ensurePanelState);
    const setPanelState = useSidebarUiStore((state) => state.setPanelState);
    const value = useSidebarUiStore((state) => {
        const contextState = state.contextStates[contextKey];
        return contextState?.[side]?.panelStateByPanelId[panelId] as T | undefined;
    });
    const defaultStateRef = React.useRef(defaultState);

    React.useEffect(() => {
        defaultStateRef.current = defaultState;
    }, [defaultState]);

    React.useEffect(() => {
        if (value !== undefined) return;
        ensurePanelState(contextKey, side, panelId, defaultStateRef.current);
    }, [contextKey, ensurePanelState, panelId, side, value]);

    const setValue = React.useCallback((next: React.SetStateAction<T>) => {
        const previous = (useSidebarUiStore.getState().contextStates[contextKey]?.[side]?.panelStateByPanelId[panelId] as T | undefined)
            ?? defaultStateRef.current;
        const resolved = typeof next === 'function'
            ? (next as (previousValue: T) => T)(previous)
            : next;
        setPanelState(contextKey, side, panelId, resolved);
    }, [contextKey, panelId, setPanelState, side]);

    return [value ?? defaultStateRef.current, setValue];
}
