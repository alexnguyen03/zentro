import React, { useCallback, useEffect, useState } from 'react';
import { Copy, Minus, Square, X } from 'lucide-react';
import { Button } from '../../ui';
import { WindowIsMaximised } from '../../../../wailsjs/runtime/runtime';

interface WindowControlsProps {
    onMinimize: () => void;
    onToggleMaximize: () => void;
    onClose: () => void;
}

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

    return (
        <div className="flex items-center gap-0.5 ml-0.5">
            <Button
                variant="ghost"
                size="icon"
                className="hover:bg-[rgba(255,189,46,0.2)] hover:text-[#ffbd2e]"
                title="Minimize"
                onClick={onMinimize}
            >
                <Minus size={12} />
            </Button>
            <Button
                variant="ghost"
                size="icon"
                className="hover:bg-[rgba(40,201,98,0.2)] hover:text-[#28c962]"
                title={isMaximised ? 'Restore' : 'Maximize'}
                onClick={handleToggleMaximize}
            >
                {isMaximised ? <Copy size={13} /> : <Square size={13} />}
            </Button>
            <Button
                variant="ghost"
                size="icon"
                className="hover:bg-[rgba(255,95,87,0.2)] hover:text-[#ff5f57]"
                title="Close"
                onClick={onClose}
            >
                <X size={13} />
            </Button>
        </div>
    );
};
