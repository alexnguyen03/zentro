import React, { useEffect, useState, useRef } from 'react';
import ReactDOM from 'react-dom';
import { Loader, Search, ArrowLeft, X } from 'lucide-react';
import { useConnectionStore } from '../../stores/connectionStore';
import { Connect, SwitchDatabase } from '../../../wailsjs/go/app/App';
import { cn } from '../../lib/cn';
import { makeDefaultForm } from '../../lib/providers';
import { useConnectionForm } from '../../hooks/useConnectionForm';
import { ProviderGrid } from '../connection/ProviderGrid';
import { ConnectionForm } from '../connection/ConnectionForm';

type View = 'list' | 'new-connection';

interface WorkspaceModalProps { onClose: () => void; }

export const WorkspaceModal: React.FC<WorkspaceModalProps> = ({ onClose }) => {
    const { connections, databases, activeProfile } = useConnectionStore();
    const existingConnections = useConnectionStore(s => s.connections);
    const existingNames = existingConnections.map(c => c.name!).filter(Boolean);

    const [view, setView] = useState<View>('list');
    const [selectedConn, setSelectedConn] = useState<string>(activeProfile?.name ?? '');
    const [connecting, setConnecting] = useState(false);
    const [connError, setConnError] = useState<string | null>(null);
    const [connFilter, setConnFilter] = useState('');
    const [dbFilter, setDbFilter] = useState('');

    const inputRef = useRef<HTMLInputElement>(null);

    const form = useConnectionForm({
        existingNames,
        onSaved: () => setView('list'),
    });

    useEffect(() => { if (inputRef.current) inputRef.current.focus(); }, []);
    useEffect(() => { if (activeProfile?.name) setSelectedConn(activeProfile.name); }, [activeProfile?.name]);
    useEffect(() => {
        if (view !== 'list') return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose, view]);

    // ── List handlers ─────────────────────────────────────────────────────────
    const handleSelectConn = async (name: string) => {
        setConnError(null);
        setSelectedConn(name);
        if (name === activeProfile?.name) return;
        setConnecting(true);
        try { await Connect(name); }
        catch (err: any) { setConnError(typeof err === 'string' ? err : err?.message || String(err)); }
        finally { setConnecting(false); }
    };

    const handleSelectDb = async (dbName: string) => {
        onClose();
        if (activeProfile?.db_name === dbName) return;
        try { await SwitchDatabase(dbName); }
        catch (err) { console.error('WorkspaceModal: switch db failed:', err); }
    };

    const handleOpenNewConnection = () => {
        form.resetForm();
        setView('new-connection');
    };

    const filteredConns = connections.filter(c => c.name?.toLowerCase().includes(connFilter.toLowerCase()));
    const filteredDbs = (selectedConn === activeProfile?.name ? databases : [])
        .filter(d => d.toLowerCase().includes(dbFilter.toLowerCase()));

    // ── Style tokens ──────────────────────────────────────────────────────────
    const colClass = 'flex-1 flex flex-col overflow-hidden';
    const headerClass = 'px-4 py-3 bg-bg-tertiary text-[11px] font-semibold uppercase text-text-secondary border-b border-border shrink-0';
    const filterContainerClass = 'px-3 py-2 border-b border-border bg-bg-primary flex items-center shrink-0';
    const searchInputClass = 'w-full bg-transparent border-none text-text-primary outline-none text-[13px] px-1 placeholder:text-text-muted';
    const listClass = 'flex-1 overflow-y-auto py-2 bg-bg-primary';
    const itemClass = 'px-4 py-[7px] cursor-pointer whitespace-nowrap overflow-hidden text-ellipsis transition-colors duration-100 select-none text-[13px] hover:bg-bg-tertiary hover:text-text-primary';
    const itemActiveClass = 'bg-bg-hover border-l-[3px] border-l-success text-success font-medium';
    const itemEmptyClass = 'p-4 text-text-secondary text-center text-xs';

    // ── Render ────────────────────────────────────────────────────────────────
    return ReactDOM.createPortal(
        <div
            className="fixed inset-0 bg-black/40 z-[9999] flex items-center justify-center animate-in fade-in duration-150"
            onClick={view === 'list' ? onClose : undefined}
        >
            <div
                className="bg-bg-secondary border border-border rounded-lg w-[600px] h-[480px] flex flex-col shadow-[0_10px_30px_rgba(0,0,0,0.3)] overflow-hidden text-text-primary text-[13px] animate-in slide-in-from-bottom-2 duration-150"
                onClick={e => e.stopPropagation()}
            >
                {view === 'list' ? (
                    /* ── LIST VIEW ──────────────────────────────────────────── */
                    <div className="flex flex-1 overflow-hidden">
                        {/* Connections pane */}
                        <div className={cn(colClass, 'border-r border-border')}>
                            <div className={headerClass}>Connection</div>
                            <div className={filterContainerClass}>
                                <Search size={13} className="text-text-muted mr-2 shrink-0" />
                                <input ref={inputRef} className={searchInputClass} placeholder="Search connections..." value={connFilter} onChange={e => setConnFilter(e.target.value)} />
                            </div>
                            <div className={listClass}>
                                {filteredConns.map(conn => (
                                    <div key={conn.name} className={cn(itemClass, selectedConn === conn.name && itemActiveClass)} onClick={() => handleSelectConn(conn.name!)}>
                                        {conn.name}
                                    </div>
                                ))}
                                {filteredConns.length === 0 && <div className={itemEmptyClass}>No connections found</div>}
                            </div>
                            <div className="px-[10%] py-2 bg-bg-primary shrink-0">
                                <button className="w-full bg-success text-white border-none px-4 py-2 rounded cursor-pointer text-[13px] font-medium transition-all duration-100 hover:brightness-110 active:translate-y-px" onClick={handleOpenNewConnection}>
                                    New connection
                                </button>
                            </div>
                        </div>

                        {/* Databases pane */}
                        <div className={colClass}>
                            <div className={headerClass}>Database</div>
                            <div className={filterContainerClass}>
                                <Search size={13} className="text-text-muted mr-2 shrink-0" />
                                <input className={searchInputClass} placeholder="Search databases..." value={dbFilter} onChange={e => setDbFilter(e.target.value)} />
                            </div>
                            <div className={listClass}>
                                {connecting ? (
                                    <div className={cn(itemEmptyClass, 'flex items-center justify-center')}>
                                        <Loader size={13} className="mr-2 animate-spin" /> Connecting...
                                    </div>
                                ) : connError ? (
                                    <div className={cn(itemEmptyClass, 'text-error')}>{connError}</div>
                                ) : filteredDbs.length === 0 ? (
                                    <div className={itemEmptyClass}>{databases.length === 0 ? 'No databases' : 'No matches'}</div>
                                ) : (
                                    filteredDbs.map(db => (
                                        <div key={db} className={cn(itemClass, activeProfile?.db_name === db && itemActiveClass)} onClick={() => handleSelectDb(db)}>
                                            {db}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    /* ── NEW CONNECTION VIEW ────────────────────────────────── */
                    <div className="flex flex-1 overflow-hidden">
                        {/* Left — provider picker */}
                        <div className={cn(colClass, 'border-r border-border max-w-[185px] min-w-[185px]')}>
                            <div className={headerClass}>Provider</div>
                            <ProviderGrid
                                selected={form.selectedProvider}
                                onSelect={form.handleDriverChange}
                            />
                            <div className="px-3 py-2 bg-bg-primary shrink-0">
                                <button
                                    type="button"
                                    className="w-full flex items-center justify-center gap-1.5 border border-border text-text-secondary px-4 py-2 rounded cursor-pointer text-[13px] transition-all duration-100 hover:bg-bg-tertiary hover:text-text-primary"
                                    onClick={() => setView('list')}
                                >
                                    <ArrowLeft size={13} /> Back
                                </button>
                            </div>
                        </div>

                        {/* Right — form */}
                        <div className={cn(colClass, 'bg-bg-primary')}>
                            <div className={cn(headerClass, 'flex items-center justify-between')}>
                                <span>New Connection</span>
                                <button className="text-text-muted hover:text-text-primary transition-colors bg-transparent border-none cursor-pointer p-0.5 rounded" onClick={onClose}>
                                    <X size={12} />
                                </button>
                            </div>
                            <ConnectionForm
                                formData={form.formData}
                                connString={form.connString}
                                testing={form.testing}
                                saving={form.saving}
                                testResult={form.testResult}
                                errorMsg={form.errorMsg}
                                successMsg={form.successMsg}
                                isEditing={false}
                                showUriField
                                onChange={form.handleChange}
                                onConnStringChange={form.handleParseConnectionString}
                                onTest={form.handleTest}
                                onSave={form.handleSave}
                                onCancel={() => setView('list')}
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
};
