import { useEffect } from 'react';
import { EventsOn } from '../../../wailsjs/runtime/runtime';
import { useEditorStore } from '../../stores/editorStore';
import { forceQuitWithAutosave } from './forceQuitWithAutosave';

export function useBeforeCloseGuard(onRequireConfirm: () => void) {
    useEffect(() => {
        const off = EventsOn('app:before-close', () => {
            const running = useEditorStore.getState().groups.some((g) => g.tabs.some((t) => t.isRunning));
            if (!running) {
                forceQuitWithAutosave().catch(() => {});
                return;
            }
            onRequireConfirm();
        });
        return () => {
            if (typeof off === 'function') off();
        };
    }, [onRequireConfirm]);
}

