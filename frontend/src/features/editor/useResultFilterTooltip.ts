import React from 'react';

export function useResultFilterTooltip() {
    const [showTooltip, setShowTooltip] = React.useState(false);
    const tooltipTimeout = React.useRef<number>();

    const onMouseEnter = React.useCallback(() => {
        if (tooltipTimeout.current) {
            clearTimeout(tooltipTimeout.current);
        }
        setShowTooltip(true);
    }, []);

    const onMouseLeave = React.useCallback(() => {
        tooltipTimeout.current = window.setTimeout(() => setShowTooltip(false), 200);
    }, []);

    React.useEffect(() => {
        return () => {
            if (tooltipTimeout.current) {
                clearTimeout(tooltipTimeout.current);
            }
        };
    }, []);

    return {
        showTooltip,
        setShowTooltip,
        onMouseEnter,
        onMouseLeave,
    };
}
