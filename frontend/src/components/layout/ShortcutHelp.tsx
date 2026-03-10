import React, { useEffect } from 'react';
import { Keyboard } from 'lucide-react';
import { Modal } from './Modal';

interface ShortcutHelpProps {
    isOpen: boolean;
    onClose: () => void;
}

const shortcuts: { action: string; keys: string }[] = [
    { action: 'Run query', keys: 'Ctrl+Enter' },
    { action: 'Cancel query (while running)', keys: 'Escape' },
    { action: 'New tab', keys: 'Ctrl+T' },
    { action: 'Close tab', keys: 'Ctrl+W' },
    { action: 'Rename tab', keys: 'F2' },
    { action: 'Keyboard shortcuts', keys: '?' },
];

export const ShortcutHelp: React.FC<ShortcutHelpProps> = ({ isOpen, onClose }) => {
    useEffect(() => {
        if (!isOpen) return;
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [isOpen, onClose]);

    const title = (
        <div className="flex items-center gap-2">
            <Keyboard size={16} />
            <span>Keyboard Shortcuts</span>
        </div>
    );

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={title as unknown as string} // Modal expects string for title, but rendering node also works if we bypass types or we can just pass string and icon as children. Wait, Modal title is rendered as <h2>{title}</h2> so we can just pass react node as any
            width={440}
        >
            <table className="w-full border-collapse py-2">
                <tbody>
                    {shortcuts.map((s, idx) => (
                        <tr key={s.action} className={idx !== shortcuts.length - 1 ? "border-b border-white/5" : ""}>
                            <td className="py-2.5 pr-5 text-[13px] text-text-primary w-[60%]">{s.action}</td>
                            <td className="py-2.5 text-right whitespace-nowrap">
                                {s.keys.split('+').map((k, i) => (
                                    <React.Fragment key={k}>
                                        {i > 0 && <span className="text-[11px] text-text-secondary mx-0.5">+</span>}
                                        <kbd className="bg-bg-tertiary border border-border rounded-[3px] px-1.5 py-[1px] text-[11px] font-mono text-text-primary">
                                            {k}
                                        </kbd>
                                    </React.Fragment>
                                ))}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </Modal>
    );
};
