import { useEffect, useRef } from 'react';
import { useEditorStore } from '../../stores/editorStore';
import { TAB_TYPE } from '../../lib/constants';
import {
    QUERY_AUTOSAVE_DEBOUNCE_MS,
    QUERY_AUTOSAVE_INTERVAL_MS,
    clearAutosaveStateForMissingTabs,
    ensureAutosaveBaseline,
    isAutosaveEligible,
    isTabDirtyForAutosave,
    saveQueryTabById,
} from './scriptAutosave';

export function useQueryTabAutosave() {
    const groups = useEditorStore((state) => state.groups);
    const timersRef = useRef<Map<string, number>>(new Map());

    useEffect(() => {
        const liveTabIds = new Set<string>();

        for (const group of groups) {
            for (const tab of group.tabs) {
                if (tab.type !== TAB_TYPE.QUERY) continue;
                liveTabIds.add(tab.id);
                ensureAutosaveBaseline(tab.id, tab.query || '');

                const isDirty = isTabDirtyForAutosave(tab);
                const canSave = isAutosaveEligible(tab);
                const existing = timersRef.current.get(tab.id);

                if (isDirty && canSave && !existing) {
                    const timer = window.setTimeout(() => {
                        void saveQueryTabById(tab.id).catch(() => undefined);
                        timersRef.current.delete(tab.id);
                    }, QUERY_AUTOSAVE_DEBOUNCE_MS);
                    timersRef.current.set(tab.id, timer);
                    continue;
                }

                if ((!isDirty || !canSave) && existing) {
                    window.clearTimeout(existing);
                    timersRef.current.delete(tab.id);
                }
            }
        }

        clearAutosaveStateForMissingTabs(liveTabIds);

        for (const [tabId, timer] of Array.from(timersRef.current.entries())) {
            if (!liveTabIds.has(tabId)) {
                window.clearTimeout(timer);
                timersRef.current.delete(tabId);
            }
        }
    }, [groups]);

    useEffect(() => {
        const interval = window.setInterval(() => {
            const state = useEditorStore.getState();
            for (const group of state.groups) {
                for (const tab of group.tabs) {
                    if (tab.type !== TAB_TYPE.QUERY) continue;
                    if (!isAutosaveEligible(tab) || !isTabDirtyForAutosave(tab)) continue;
                    void saveQueryTabById(tab.id).catch(() => undefined);
                }
            }
        }, QUERY_AUTOSAVE_INTERVAL_MS);

        return () => {
            window.clearInterval(interval);
            for (const timer of timersRef.current.values()) {
                window.clearTimeout(timer);
            }
            timersRef.current.clear();
        };
    }, []);
}
