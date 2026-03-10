import React, { useEffect, useState, useRef } from 'react';
import ReactDOM from 'react-dom';
import { Loader, Search } from 'lucide-react';
import { useConnectionStore } from '../../stores/connectionStore';
import { Connect, SwitchDatabase } from '../../../wailsjs/go/app/App';
import { ConnectionDialog } from '../sidebar/ConnectionDialog';
import { cn } from '../../lib/cn';

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

    const colClass = "flex-1 flex flex-col overflow-hidden";
    const headerClass = "px-4 py-3 bg-bg-tertiary text-[11px] font-semibold uppercase text-text-secondary border-b border-border";
    const filterContainerClass = "px-3 py-2 border-b border-border bg-bg-primary flex items-center";
    const inputClass = "w-full bg-transparent border-none text-text-primary outline-none text-[13px] px-1 placeholder:text-text-muted";
    const listClass = "flex-1 overflow-y-auto py-2 bg-bg-primary";
    const itemClass = "px-4 py-2 cursor-pointer whitespace-nowrap overflow-hidden text-ellipsis transition-colors duration-100 select-none hover:bg-bg-tertiary hover:text-text-primary";
    const itemActiveClass = "bg-bg-hover border-l-3 border-l-success text-success font-medium";
    const itemEmptyClass = "p-4 text-text-secondary text-center text-xs";

    return ReactDOM.createPortal(
        <div className="fixed inset-0 bg-black/40 z-[9999] flex items-center justify-center animate-in fade-in duration-150" onClick={onClose}>
            <div className="bg-bg-secondary border border-border rounded-lg w-[600px] h-[480px] flex flex-col shadow-[0_10px_30px_rgba(0,0,0,0.3)] overflow-hidden text-text-primary text-[13px] animate-in slide-in-from-bottom-2 duration-150" onClick={e => e.stopPropagation()}>
                <div className="flex flex-1 overflow-hidden">
                    {/* Connections Pane */}
                    <div className={cn(colClass, "border-r border-border")}>
                        <div className={headerClass}>Connection</div>
                        <div className={filterContainerClass}>
                            <Search size={14} className="text-text-muted mr-2 shrink-0" />
                            <input
                                ref={inputRef}
                                className={inputClass}
                                placeholder="Search connections..."
                                value={connFilter}
                                onChange={e => setConnFilter(e.target.value)}
                            />
                        </div>
                        <div className={listClass}>
                            {filteredConns.map(conn => (
                                <div
                                    key={conn.name}
                                    className={cn(itemClass, selectedConn === conn.name && itemActiveClass)}
                                    onClick={() => handleSelectConn(conn.name!)}
                                >
                                    {conn.name}
                                </div>
                            ))}
                            {filteredConns.length === 0 && (
                                <div className={itemEmptyClass}>No connections found</div>
                            )}
                        </div>
                        <div className="px-[10%] py-2 bg-bg-primary flex justify-center shrink-0">
                            <button className="w-full bg-success text-white border-none px-4 py-2 rounded cursor-pointer text-[13px] font-medium transition-all duration-100 ease-in-out hover:brightness-110 hover:opacity-90 active:translate-y-px" onClick={() => setShowNewDialog(true)}>
                                New connection
                            </button>
                        </div>
                    </div>

                    {/* Databases Pane */}
                    <div className={colClass}>
                        <div className={headerClass}>Database</div>
                        <div className={filterContainerClass}>
                            <Search size={14} className="text-text-muted mr-2 shrink-0" />
                            <input
                                className={inputClass}
                                placeholder="Search databases..."
                                value={dbFilter}
                                onChange={e => setDbFilter(e.target.value)}
                            />
                        </div>
                        <div className={listClass}>
                            {connecting ? (
                                <div className={cn(itemEmptyClass, "flex items-center justify-center")}>
                                    <Loader size={14} className="mr-2 animate-spin" />
                                    Connecting...
                                </div>
                            ) : error ? (
                                <div className={cn(itemEmptyClass, "text-error")}>
                                    {error}
                                </div>
                            ) : filteredDbs.length === 0 ? (
                                <div className={itemEmptyClass}>
                                    {databases.length === 0 && !connecting ? 'No databases' : 'No matches'}
                                </div>
                            ) : (
                                filteredDbs.map(db => (
                                    <div
                                        key={db}
                                        className={cn(itemClass, activeProfile?.db_name === db && itemActiveClass)}
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
