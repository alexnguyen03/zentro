import { beforeEach, describe, expect, it } from 'vitest';
import { STORAGE_KEY } from '../lib/constants';
import { buildSidebarContextKey, useSidebarUiStore } from './sidebarUiStore';

describe('sidebarUiStore', () => {
    beforeEach(() => {
        localStorage.removeItem(STORAGE_KEY.SIDEBAR_UI);
        useSidebarUiStore.setState({ contextStates: {} });
    });

    it('builds stable context key from project/environment', () => {
        expect(buildSidebarContextKey('project-a', 'dev')).toBe('project-a::dev');
        expect(buildSidebarContextKey('', '')).toBe('__global__::__default__');
        expect(buildSidebarContextKey(null, undefined)).toBe('__global__::__default__');
    });

    it('hydrates defaults and updates active panel + width per side', () => {
        const store = useSidebarUiStore.getState();
        const key = buildSidebarContextKey('project-a', 'dev');

        store.ensureContextState(key, {
            primary: { width: 420, activePanelId: 'history' },
            secondary: { width: 360, activePanelId: 'bookmark' },
        });

        store.setActivePanel(key, 'primary', 'scripts');
        store.setWidth(key, 'primary', 9999);
        store.setWidth(key, 'secondary', 100);

        const state = useSidebarUiStore.getState().contextStates[key];
        expect(state.primary.activePanelId).toBe('scripts');
        expect(state.primary.width).toBe(800);
        expect(state.secondary.activePanelId).toBe('bookmark');
        expect(state.secondary.width).toBe(220);
    });

    it('persists panel state by context + side + panel id', () => {
        const store = useSidebarUiStore.getState();
        const key = buildSidebarContextKey('project-b', 'sta');

        store.ensureContextState(key);
        store.ensurePanelState(key, 'primary', 'explorer', { filter: '', fuzzyMatch: false });
        store.setPanelState(key, 'primary', 'explorer', { filter: 'users', fuzzyMatch: true });
        store.ensurePanelState(key, 'primary', 'explorer', { filter: 'ignored', fuzzyMatch: false });

        const panelState = useSidebarUiStore.getState().contextStates[key].primary.panelStateByPanelId.explorer as {
            filter: string;
            fuzzyMatch: boolean;
        };
        expect(panelState).toEqual({ filter: 'users', fuzzyMatch: true });
    });
});
