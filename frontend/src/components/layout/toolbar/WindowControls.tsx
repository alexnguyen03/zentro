import React from 'react';
import { Minus, X } from 'lucide-react';
import { Button } from '../../ui';

interface WindowControlsProps {
    onMinimize: () => void;
    onToggleMaximize: () => void;
    onClose: () => void;
}

export const WindowControls: React.FC<WindowControlsProps> = ({
    onMinimize,
    onToggleMaximize,
    onClose,
}) => (
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
            title="Maximize / Restore"
            onClick={onToggleMaximize}
        >
            <span className="block w-2.5 h-2.5 border-[1.5px] border-current rounded-md" />
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
