import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Search, ArrowLeft, X, Info, Database } from 'lucide-react';
import { useConnectionStore } from '../../stores/connectionStore';
import { Connect, SwitchDatabase, LoadConnections } from '../../../wailsjs/go/app/App';
import { models } from '../../../wailsjs/go/models';
import { cn } from '../../lib/cn';
import { getProvider, makeDefaultForm } from '../../lib/providers';
import { DRIVER } from '../../lib/constants';
import { useConnectionForm } from '../../hooks/useConnectionForm';
import { ProviderGrid } from '../connection/ProviderGrid';
import { ConnectionForm } from '../connection/ConnectionForm';
import { Button, Spinner, ModalBackdrop } from '../ui';

type ConnectionProfile = models.ConnectionProfile;
type View = 'list' | 'new-connection';

interface WorkspaceModalProps { onClose: () => void; }

export const WorkspaceModal: React.FC<WorkspaceModalProps> = ({ onClose }) => {
    const { connections, databases, activeProfile, setConnections } = useConnectionStore();
    const existingConnections = useConnectionStore(s => s.connections);
    const existingNames = existingConnections.map(c => c.name!).filter(Boolean);

    const [view, setView] = useState<View>('list');
    const [editProfile, setEditProfile] = useState<ConnectionProfile | null>(null);
    const [selectedConn, setSelectedConn] = useState<string>(activeProfile?.name ?? '');
    const [connecting, setConnecting] = useState(false);
    const [connError, setConnError] = useState<string | null>(null);
    const [connFilter, setConnFilter] = useState('');
    const [dbFilter, setDbFilter] = useState('');

    const [focusedPane, setFocusedPane] = useState<'conn' | 'db'>('conn');
    const [connNavIndex, setConnNavIndex] = useState(0);
    const [dbNavIndex, setDbNavIndex] = useState(0);

    const inputRef = useRef<HTMLInputElement>(null);
    const dbInputRef = useRef<HTMLInputElement>(null);
    const activeConnRef = useRef<HTMLDivElement>(null);
    const activeDbRef = useRef<HTMLDivElement>(null);

    const refreshConnections = useCallback(async () => {
        try {
            const data = await LoadConnections();
            setConnections(data || []);
        } catch (e) {
            console.error('Failed to refresh connections:', e);
        }
    }, [setConnections]);

    const form = useConnectionForm({
        profile: editProfile,
        existingNames,
        onSaved: async () => { await refreshConnections(); setView('list'); setEditProfile(null); },
        onClose: () => { setView('list'); setEditProfile(null); }
    });

    useEffect(() => { refreshConnections(); if (inputRef.current) inputRef.current.focus(); }, []);
    useEffect(() => { if (activeProfile?.name) setSelectedConn(activeProfile.name); }, [activeProfile?.name]);
    // ── List handlers ─────────────────────────────────────────────────────────
    const handleSelectConn = useCallback(async (name: string) => {
        setConnError(null);
        setSelectedConn(name);
        if (name === activeProfile?.name) return;
        setConnecting(true);
        try { await Connect(name); }
        catch (err: any) { setConnError(typeof err === 'string' ? err : err?.message || String(err)); }
        finally { setConnecting(false); }
    }, [activeProfile?.name]);

    const handleSelectDb = useCallback(async (dbName: string) => {
        onClose();
        if (activeProfile?.db_name === dbName) return;
        try { await SwitchDatabase(dbName); }
        catch (err) { console.error('WorkspaceModal: switch db failed:', err); }
    }, [activeProfile?.db_name, onClose]);

    const filteredConns = React.useMemo(() => connections.filter(c => c.name?.toLowerCase().includes(connFilter.toLowerCase())), [connections, connFilter]);
    const filteredDbs = React.useMemo(() => (selectedConn === activeProfile?.name ? databases : [])
        .filter(d => d.toLowerCase().includes(dbFilter.toLowerCase())), [selectedConn, activeProfile?.name, databases, dbFilter]);

    useEffect(() => {
        if (view !== 'list') return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (focusedPane === 'conn') {
                    setConnNavIndex(i => Math.min(i + 1, Math.max(0, filteredConns.length - 1)));
                } else {
                    setDbNavIndex(i => Math.min(i + 1, Math.max(0, filteredDbs.length - 1)));
                }
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (focusedPane === 'conn') {
                    setConnNavIndex(i => Math.max(i - 1, 0));
                } else {
                    setDbNavIndex(i => Math.max(i - 1, 0));
                }
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (focusedPane === 'conn') {
                    const conn = filteredConns[connNavIndex];
                    if (conn?.name) handleSelectConn(conn.name);
                } else {
                    const db = filteredDbs[dbNavIndex];
                    if (db) handleSelectDb(db);
                }
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose, view, focusedPane, connNavIndex, dbNavIndex, filteredConns, filteredDbs, handleSelectConn, handleSelectDb]);

    useEffect(() => {
        if (view !== 'list') return;
        if (focusedPane === 'conn') {
            activeConnRef.current?.scrollIntoView({ block: 'nearest' });
        } else if (focusedPane === 'db') {
            activeDbRef.current?.scrollIntoView({ block: 'nearest' });
        }
    }, [connNavIndex, dbNavIndex, focusedPane, view]);

    const handleOpenNewConnection = () => {
        form.resetForm();
        setEditProfile(null);
        setView('new-connection');
    };

    const handleOpenEditConnection = (e: React.MouseEvent, conn: ConnectionProfile) => {
        e.stopPropagation();
        setEditProfile(conn);
        setView('new-connection');
    };



    // ── Style tokens ──────────────────────────────────────────────────────────
    const colClass = 'flex-1 flex flex-col overflow-hidden';
    const headerClass = 'px-4 py-3 bg-bg-tertiary text-[14px] font-semibold text-text-secondary border-b border-border shrink-0';
    const filterContainerClass = 'px-3 py-2 border-b border-border bg-bg-primary flex items-center shrink-0';
    const searchInputClass = 'w-full bg-transparent border-none text-text-primary outline-none text-[13px] px-1 placeholder:text-text-muted';
    const listClass = 'flex-1 overflow-y-auto py-2 bg-bg-primary';
    const itemEmptyClass = 'p-4 text-text-secondary text-center text-xs';

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <ModalBackdrop onClose={view === 'list' ? onClose : undefined}>
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
                                <input 
                                    ref={inputRef} 
                                    className={searchInputClass} 
                                    placeholder="Search connections..." 
                                    value={connFilter} 
                                    onChange={e => { setConnFilter(e.target.value); setConnNavIndex(0); setFocusedPane('conn'); }}
                                    onFocus={() => setFocusedPane('conn')}
                                />
                            </div>
                            <div className={listClass}>
                                {filteredConns.map((conn, idx) => {
                                    const provider = getProvider(conn.driver || DRIVER.POSTGRES);
                                    const isActive = selectedConn === conn.name;
                                    const isNavFocus = focusedPane === 'conn' && connNavIndex === idx;

                                    return (
                                        <div
                                            key={conn.name}
                                            ref={isNavFocus ? activeConnRef : undefined}
                                            className={cn(
                                                "group flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors duration-200 border-l-[3px]",
                                                isActive ? "bg-bg-tertiary border-l-success" : "border-l-transparent hover:bg-bg-tertiary/50",
                                                isNavFocus && "ring-1 ring-inset ring-text-muted/30 bg-bg-tertiary/80"
                                            )}
                                            onClick={() => handleSelectConn(conn.name!)}
                                            onMouseEnter={() => { setFocusedPane('conn'); setConnNavIndex(idx); }}
                                        >
                                            {/* Logo */}
                                            <div className="w-13 h-13 rounded-md flex items-center justify-center p-1 shrink-0">
                                                <img
                                                    src={provider.icon}
                                                    alt={provider.label}
                                                    className="w-[85%] h-[85%] object-contain"
                                                />
                                            </div>

                                            {/* Details */}
                                            <div className="flex-1 min-w-0">
                                                <div className={cn(
                                                    "font-bold truncate text-[14px] mb-0.5",
                                                    isActive ? "text-success" : "text-text-primary"
                                                )}>
                                                    {conn.name}
                                                </div>
                                                <div className="text-[11px] text-text-muted/80 truncate font-mono">
                                                    {provider.requiresHost ? `${conn.host}:${conn.port}` : 'Local Database'}
                                                </div>
                                            </div>

                                            {/* Edit Button */}
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="w-7 h-7 opacity-0 group-hover:opacity-100"
                                                onClick={(e) => handleOpenEditConnection(e, conn)}
                                                title="Edit Connection"
                                            >
                                                <Info size={14} className="text-text-muted" />
                                            </Button>
                                        </div>
                                    );
                                })}
                                {filteredConns.length === 0 && <div className={itemEmptyClass}>No connections found</div>}
                            </div>
                            <div className="px-[10%] py-2 bg-bg-primary shrink-0">
                                <Button variant="success" className="w-full" onClick={handleOpenNewConnection}>
                                    New connection
                                </Button>
                            </div>
                        </div>

                        {/* Databases pane */}
                        <div className={colClass}>
                            <div className={headerClass}>Database</div>
                            <div className={filterContainerClass}>
                                <Search size={13} className="text-text-muted mr-2 shrink-0" />
                                <input 
                                    ref={dbInputRef}
                                    className={searchInputClass} 
                                    placeholder="Search databases..." 
                                    value={dbFilter} 
                                    onChange={e => { setDbFilter(e.target.value); setDbNavIndex(0); setFocusedPane('db'); }}
                                    onFocus={() => setFocusedPane('db')}
                                />
                            </div>
                            <div className={listClass}>
                                {connecting ? (
                                    <div className={cn(itemEmptyClass, 'flex items-center justify-center')}>
                                        <Spinner size={13} className="mr-2" /> Connecting...
                                    </div>
                                ) : connError ? (
                                    <div className={cn(itemEmptyClass, 'text-error')}>{connError}</div>
                                ) : filteredDbs.length === 0 ? (
                                    <div className={itemEmptyClass}>{databases.length === 0 ? 'No databases' : 'No matches'}</div>
                                ) : (
                                    filteredDbs.map((db, idx) => {
                                        const isNavFocus = focusedPane === 'db' && dbNavIndex === idx;
                                        const isActive = activeProfile?.db_name === db;

                                        return (
                                            <div 
                                                key={db} 
                                                ref={isNavFocus ? activeDbRef : undefined}
                                                className={cn(
                                                    "group flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors duration-200 border-l-[3px]",
                                                    isActive ? "bg-bg-tertiary border-l-success" : "border-l-transparent hover:bg-bg-tertiary/50",
                                                    isNavFocus && "ring-1 ring-inset ring-text-muted/30 bg-bg-tertiary/80"
                                                )} 
                                                onClick={() => handleSelectDb(db)}
                                                onMouseEnter={() => { setFocusedPane('db'); setDbNavIndex(idx); }}
                                            >
                                                {/* Icon */}
                                                <div className="w-13 h-13 rounded-md flex items-center justify-center p-1 shrink-0 text-text-muted group-hover:text-success transition-colors">
                                                    <Database size={22} strokeWidth={1.5} />
                                                </div>

                                                {/* Details */}
                                                <div className="flex-1 min-w-0">
                                                    <div className={cn(
                                                        "font-bold truncate text-[14px]",
                                                        isActive ? "text-success" : "text-text-primary"
                                                    )}>
                                                        {db}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
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
                                locked={form.isEditing}
                                onSelect={form.handleDriverChange}
                            />
                            <div className="px-3 py-2 bg-bg-primary shrink-0">
                                <Button
                                    variant="solid"
                                    className="w-full flex items-center justify-center gap-1.5"
                                    onClick={() => { setView('list'); setEditProfile(null); }}
                                >
                                    <ArrowLeft size={13} /> Back
                                </Button>
                            </div>
                        </div>

                        {/* Right — form */}
                        <div className={cn(colClass, 'bg-bg-primary')}>
                            <div className={cn(headerClass, 'flex items-center justify-between')}>
                                <span>{form.isEditing ? `Edit — ${editProfile?.name}` : 'New Connection'}</span>
                                <Button variant="ghost" size="icon" className="w-5 h-5" onClick={onClose}>
                                    <X size={12} />
                                </Button>
                            </div>
                            <ConnectionForm
                                formData={form.formData}
                                connString={form.connString}
                                testing={form.testing}
                                saving={form.saving}
                                testResult={form.testResult}
                                errorMsg={form.errorMsg}
                                successMsg={form.successMsg}
                                isEditing={form.isEditing}
                                showUriField={!form.isEditing}
                                onChange={form.handleChange}
                                onConnStringChange={form.handleParseConnectionString}
                                onTest={form.handleTest}
                                onSave={form.handleSave}
                                onCancel={() => { setView('list'); setEditProfile(null); }}
                            />
                        </div>
                    </div>
                )}
            </div>
        </ModalBackdrop>
    );
};
