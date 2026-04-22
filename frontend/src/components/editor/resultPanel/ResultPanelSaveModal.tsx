import React from 'react';
import { Copy, FilePlus, Play } from 'lucide-react';
import { Button, Modal } from '../../ui';

interface ResultPanelSaveModalProps {
    isOpen: boolean;
    script: string;
    onClose: () => void;
    onCopyScript: () => void;
    onOpenInNewTab: () => void;
    onExecute: () => void;
}

export const ResultPanelSaveModal: React.FC<ResultPanelSaveModalProps> = ({
    isOpen,
    script,
    onClose,
    onCopyScript,
    onOpenInNewTab,
    onExecute,
}) => {
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Confirm Changes"
            width={600}
            footer={
                <div className="flex w-full items-center justify-end gap-2">
                    <Button variant="ghost" size="icon" onClick={onCopyScript} title="Copy Script">
                        <Copy size={14} />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={onOpenInNewTab} title="Open in New Tab">
                        <FilePlus size={14} />
                    </Button>
                    <Button variant="default" onClick={onExecute} title="Execute Update" autoFocus>
                        <Play size={14} />
                        Execute
                    </Button>
                </div>
            }
        >
            <div style={{ marginBottom: '16px' }}>
                <p style={{ fontSize: '12px', color: 'var(--color-text-dim)', marginBottom: 12 }}>
                    The following script will be generated to apply your changes:
                </p>
                <div
                    style={{
                        background: 'var(--color-bg-tertiary)',
                        padding: '12px',
                        borderRadius: 'var(--radius-md)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '12px',
                        maxHeight: '300px',
                        overflowY: 'auto',
                        whiteSpace: 'pre-wrap',
                        color: 'var(--color-text-secondary)',
                        border: '1px solid var(--color-border)',
                    }}
                >
                    {script}
                </div>
            </div>
        </Modal>
    );
};
