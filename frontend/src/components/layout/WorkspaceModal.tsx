import React, { useEffect, useState, useRef } from 'react';
import ReactDOM from 'react-dom';
import { Loader, Search } from 'lucide-react';
import { useConnectionStore } from '../../stores/connectionStore';
import { Connect, SwitchDatabase } from '../../../wailsjs/go/app/App';
import { ConnectionDialog } from '../sidebar/ConnectionDialog';
import './WorkspaceModal.css';

interface WorkspaceModalProps {
    onClose: () => void;
}

export const WorkspaceModal: React.FC<WorkspaceModalProps> = ({ onClose }) => {
    const { connections, databases, activeProfile } = useConnectionStore();

    const [selectedConn, setSelectedConn] = useState<string>(activeProfile?.name ?? '');
    const [connecting, setConnecting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [connFilter, setConnFilter] = useState('');
    const [dbFilter, setDbFilter] = useState('');
    const [showNewDialog, setShowNewDialog] = useState(false);

    const inputRef = useRef<HTMLInputElement>(null);

    // Initial focus
    useEffect(() => {
        if (inputRef.current) inputRef.current.focus();
    }, []);

    const isSelectedActive = selectedConn === activeProfile?.name;
    const pickerDbs = isSelectedActive ? databases : [];

    const handleSelectConn = async (name: string) => {
        setError(null);
        setSelectedConn(name);
        if (name === activeProfile?.name) return;

        setConnecting(true);
        try {
            await Connect(name);
        } catch (err: any) {
            console.error('WorkspaceModal: connect failed:', err);
            setError(typeof err === 'string' ? err : err?.message || String(err));
        } finally {
            setConnecting(false);
        }
    };

    const handleSelectDb = async (dbName: string) => {
        onClose();
        if (activeProfile?.db_name === dbName) return;
        try {
            await SwitchDatabase(dbName);
        } catch (err) {
            console.error('WorkspaceModal: switch db failed:', err);
        }
    };

    useEffect(() => {
        if (activeProfile?.name) setSelectedConn(activeProfile.name);
    }, [activeProfile?.name]);

    useEffect(() => {
        if (showNewDialog) return; // don't close main modal if sub-dialog is open
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose, showNewDialog]);

    const filteredConns = connections.filter(c => c.name?.toLowerCase().includes(connFilter.toLowerCase()));
    const filteredDbs = pickerDbs.filter(d => d.toLowerCase().includes(dbFilter.toLowerCase()));

    return ReactDOM.createPortal(
        <div className="ws-overlay" onClick={onClose}>
            <div className="ws-modal" onClick={e => e.stopPropagation()}>
                <div className="ws-panes">
                    {/* Connections Pane */}
                    <div className="ws-col">
                        <div className="ws-header">Connection</div>
                        <div className="ws-filter-container">
                            <Search size={14} style={{ color: 'var(--text-muted)', marginRight: 8 }} />
                            <input
                                ref={inputRef}
                                className="ws-input"
                                placeholder="Search connections..."
                                value={connFilter}
                                onChange={e => setConnFilter(e.target.value)}
                            />
                        </div>
                        <div className="ws-list">
                            {filteredConns.map(conn => (
                                <div
                                    key={conn.name}
                                    className={`ws-item ${selectedConn === conn.name ? 'selected' : ''}`}
                                    onClick={() => handleSelectConn(conn.name!)}
                                >
                                    {conn.name}
                                </div>
                            ))}
                            {filteredConns.length === 0 && (
                                <div className="ws-item-empty">No connections found</div>
                            )}
                        </div>
                        <div className="ws-new-btn-container">
                            <button className="ws-new-btn" onClick={() => setShowNewDialog(true)}>
                                new connection
                            </button>
                        </div>
                    </div>

                    {/* Databases Pane */}
                    <div className="ws-col">
                        <div className="ws-header">Database</div>
                        <div className="ws-filter-container">
                            <Search size={14} style={{ color: 'var(--text-muted)', marginRight: 8 }} />
                            <input
                                className="ws-input"
                                placeholder="Search databases..."
                                value={dbFilter}
                                onChange={e => setDbFilter(e.target.value)}
                            />
                        </div>
                        <div className="ws-list">
                            {connecting ? (
                                <div className="ws-item-empty" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Loader size={14} style={{ marginRight: 8, animation: 'spin 1s linear infinite' }} />
                                    Connecting...
                                </div>
                            ) : error ? (
                                <div className="ws-item-empty" style={{ color: 'var(--error-color)' }}>
                                    {error}
                                </div>
                            ) : filteredDbs.length === 0 ? (
                                <div className="ws-item-empty">
                                    {databases.length === 0 && !connecting ? 'No databases' : 'No matches'}
                                </div>
                            ) : (
                                filteredDbs.map(db => (
                                    <div
                                        key={db}
                                        className={`ws-item ${activeProfile?.db_name === db ? 'active' : ''}`}
                                        onClick={() => handleSelectDb(db)}
                                    >
                                        {db}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Sub-dialog for new connection */}
            <ConnectionDialog
                isOpen={showNewDialog}
                profile={null}
                onClose={() => setShowNewDialog(false)}
                onSave={() => { /* ConnectionStore syncs via events */ }}
            />
        </div>,
        document.body
    );
};
