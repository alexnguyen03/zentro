import React, { useCallback, useEffect, useState } from 'react';
import { WindowIsMaximised } from '../../../../wailsjs/runtime/runtime';
import { Button } from '../../ui';

interface WindowControlsProps {
    onMinimize: () => void;
    onToggleMaximize: () => void;
    onClose: () => void;
}

// SVG icons matching Windows 11 Segoe Fluent style
const MinimizeIcon = () => (
    <svg width="10" height="1" viewBox="0 0 10 1" fill="currentColor">
        <rect width="10" height="1" />
    </svg>
);

const MaximizeIcon = () => (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1">
        <rect x="0.5" y="0.5" width="9" height="9" />
    </svg>
);

const RestoreIcon = () => (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1">
        <rect x="3.5" y="0.5" width="7" height="7" />
        <path d="M0.5 3.5V10.5H7.5V7.5" />
    </svg>
);

const CloseIcon = () => (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round">
        <line x1="0" y1="0" x2="10" y2="10" />
        <line x1="10" y1="0" x2="0" y2="10" />
    </svg>
);

export const WindowControls: React.FC<WindowControlsProps> = ({
    onMinimize,
    onToggleMaximize,
    onClose,
}) => {
    const [isMaximised, setIsMaximised] = useState(false);

    const syncMaximisedState = useCallback(() => {
        void WindowIsMaximised()
            .then((maximised) => setIsMaximised(Boolean(maximised)))
            .catch(() => {
                // No-op in non-runtime environments.
            });
    }, []);

    useEffect(() => {
        syncMaximisedState();
        const handleWindowChange = () => syncMaximisedState();
        window.addEventListener('resize', handleWindowChange);
        window.addEventListener('focus', handleWindowChange);
        return () => {
            window.removeEventListener('resize', handleWindowChange);
            window.removeEventListener('focus', handleWindowChange);
        };
    }, [syncMaximisedState]);

    const handleToggleMaximize = () => {
        onToggleMaximize();
        window.setTimeout(syncMaximisedState, 80);
    };

    const btnBase = 'flex items-center justify-center h-full w-[46px] text-foreground/70 transition-colors duration-100 select-none';

    return (
        <div className="flex items-stretch h-10 ml-1 -mr-3">
            <Button
                type="button"
                variant="ghost"
                size="icon"
                className={`${btnBase} rounded-none hover:bg-white/10 hover:text-foreground`}
                title="Minimize"
                onClick={onMinimize}
            >
                <MinimizeIcon />
            </Button>
            <Button
                type="button"
                variant="ghost"
                size="icon"
                className={`${btnBase} rounded-none hover:bg-white/10 hover:text-foreground`}
                title={isMaximised ? 'Restore' : 'Maximize'}
                onClick={handleToggleMaximize}
            >
                {isMaximised ? <RestoreIcon /> : <MaximizeIcon />}
            </Button>
            <Button
                type="button"
                variant="ghost"
                size="icon"
                className={`${btnBase} rounded-none hover:bg-[#C42B1C] hover:text-white`}
                title="Close"
                onClick={onClose}
            >
                <CloseIcon />
            </Button>
        </div>
    );
};
