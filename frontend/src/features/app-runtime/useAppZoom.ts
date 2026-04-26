import { useEffect } from 'react';
import { applyAppZoom, useZoomStore } from '../../stores/zoomStore';

export function useAppZoom() {
    const zoomLevel = useZoomStore((state) => state.zoomLevel);

    useEffect(() => {
        applyAppZoom(zoomLevel);
    }, [zoomLevel]);
}
