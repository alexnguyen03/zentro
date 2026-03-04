import React, { useEffect } from 'react';
import { X, Keyboard } from 'lucide-react';
import './ShortcutHelp.css';

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

    if (!isOpen) return null;

    return (
        <div className="dialog-overlay" onClick={onClose}>
            <div className="shortcut-dialog" onClick={e => e.stopPropagation()}>
                <div className="dialog-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Keyboard size={14} />
                        <h3>Keyboard Shortcuts</h3>
                    </div>
                    <button className="dialog-close-btn" onClick={onClose}><X size={14} /></button>
                </div>
                <table className="shortcut-table">
                    <tbody>
                        {shortcuts.map((s) => (
                            <tr key={s.action}>
                                <td className="shortcut-action">{s.action}</td>
                                <td className="shortcut-keys">
                                    {s.keys.split('+').map((k, i) => (
                                        <React.Fragment key={k}>
                                            {i > 0 && <span className="shortcut-plus">+</span>}
                                            <kbd>{k}</kbd>
                                        </React.Fragment>
                                    ))}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
