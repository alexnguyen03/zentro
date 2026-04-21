import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { STORAGE_KEY } from '../lib/constants';

export const APP_ZOOM_ENABLED = true;

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2;
const ZOOM_STEP = 0.1;
const DEFAULT_ZOOM = 1;

function clampZoom(value: number): number {
    if (!Number.isFinite(value)) return DEFAULT_ZOOM;
    return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(value * 100) / 100));
}

interface ZoomState {
    zoomLevel: number;
    setZoomLevel: (value: number) => void;
    zoomIn: () => void;
    zoomOut: () => void;
    resetZoom: () => void;
}

export const useZoomStore = create<ZoomState>()(
    persist(
        (set, get) => ({
            zoomLevel: DEFAULT_ZOOM,
            setZoomLevel: (value) => set({ zoomLevel: clampZoom(value) }),
            zoomIn: () => set({ zoomLevel: clampZoom(get().zoomLevel + ZOOM_STEP) }),
            zoomOut: () => set({ zoomLevel: clampZoom(get().zoomLevel - ZOOM_STEP) }),
            resetZoom: () => set({ zoomLevel: DEFAULT_ZOOM }),
        }),
        {
            name: STORAGE_KEY.APP_ZOOM,
            partialize: (state) => ({ zoomLevel: state.zoomLevel }),
        },
    ),
);

export function applyAppZoom(zoomLevel: number) {
    if (typeof document === 'undefined') return;
    if (!APP_ZOOM_ENABLED) return;
    const level = clampZoom(zoomLevel);
    const appRoot = document.getElementById('root');
    if (!appRoot) return;

    if (level === 1) {
        appRoot.style.removeProperty('transform');
        appRoot.style.removeProperty('transform-origin');
        appRoot.style.removeProperty('width');
        appRoot.style.removeProperty('height');
        return;
    }

    // Scale content via transform — window/viewport stays fixed.
    // Counter-scale width/height so the root still fills the viewport after scaling.
    const inv = (1 / level) * 100;
    appRoot.style.transformOrigin = 'top left';
    appRoot.style.transform = `scale(${level})`;
    appRoot.style.width = `${inv}%`;
    appRoot.style.height = `${inv}%`;
}

export function toZoomPercent(zoomLevel: number): number {
    return Math.round(clampZoom(zoomLevel) * 100);
}
