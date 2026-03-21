import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Search, ArrowLeft, X, Info, Database, Plus } from 'lucide-react';
import { useConnectionStore } from '../../stores/connectionStore';
import { Connect, SwitchDatabase, LoadConnections } from '../../../wailsjs/go/app/App';
import { cn } from '../../lib/cn';
import { getProvider, makeDefaultForm } from '../../lib/providers';
import { DRIVER } from '../../lib/constants';
import { useConnectionForm } from '../../hooks/useConnectionForm';
import { ProviderGrid } from '../connection/ProviderGrid';
import { ConnectionForm } from '../connection/ConnectionForm';
import { Button, Spinner, ModalBackdrop } from '../ui';
import type { ConnectionProfile } from '../../types/connection';

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
    const paneTitleClass = 'px-6 pt-5 pb-2 text-[15px] font-bold text-text-primary tracking-tight';
    const filterContainerClass = 'px-6 py-2 flex items-center shrink-0 group';
    const searchInputClass = 'w-full bg-transparent border-none text-text-primary outline-none text-[13px] px-2 placeholder:text-text-muted/60 transition-all';
    const listClass = 'flex-1 overflow-y-auto px-2 py-2 flex flex-col gap-1.5';
    const itemEmptyClass = 'p-8 text-text-muted/60 text-center text-xs italic';

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <ModalBackdrop onClose={view === 'list' ? onClose : undefined}>
            <div
                className="bg-bg-secondary border border-border/40 rounded-2xl w-[720px] h-[540px] flex flex-col overflow-hidden text-text-primary text-[13px] animate-in zoom-in-95 fade-in duration-300"
                onClick={e => e.stopPropagation()}
            >
                {view === 'list' ? (
                    /* ── LIST VIEW ──────────────────────────────────────────── */
                    <div className="flex flex-1 overflow-hidden">
                        {/* Connections pane */}
                        <div className={cn(colClass, "relative border-r border-border/20")}>
                            <div className="flex items-center justify-between pr-4 sticky top-0 bg-bg-secondary z-10">
                                <h2 className={paneTitleClass}>Connections</h2>
                                <button 
                                    onClick={handleOpenNewConnection}
                                    className="p-1.5 rounded-full hover:bg-bg-tertiary text-accent transition-colors"
                                    title="Add Connection"
                                >
                                    <Plus size={16} />
                                </button>
                            </div>

                            <div className={filterContainerClass}>
                                <div className="flex flex-1 items-center bg-bg-tertiary/30 px-3 py-2 rounded-xl border border-transparent focus-within:border-accent/30 focus-within:bg-bg-tertiary/50 transition-all">
                                    <Search size={13} className="text-text-muted/50" />
                                    <input 
                                        ref={inputRef} 
                                        className={searchInputClass} 
                                        placeholder="Search..." 
                                        value={connFilter} 
                                        onChange={e => { setConnFilter(e.target.value); setConnNavIndex(0); setFocusedPane('conn'); }}
                                        onFocus={() => setFocusedPane('conn')}
                                    />
                                </div>
                            </div>

                            <div className={listClass}>
                                {filteredConns.map((conn, idx) => {
                                    const provider = getProvider(conn.driver || DRIVER.POSTGRES);
                                    const isActive = activeProfile?.name === conn.name;
                                    const isSelected = selectedConn === conn.name;
                                    const isNavFocus = focusedPane === 'conn' && connNavIndex === idx;

                                    return (
                                        <div
                                            key={conn.name}
                                            ref={isNavFocus ? activeConnRef : undefined}
                                            className={cn(
                                                "group flex items-center gap-4 px-4 py-3 rounded-xl cursor-pointer transition-all duration-300 mx-1",
                                                isSelected || isNavFocus ? "bg-bg-tertiary" : "hover:bg-bg-tertiary/40",
                                                isNavFocus && "ring-1 ring-accent/20"
                                            )}
                                            onClick={() => handleSelectConn(conn.name!)}
                                            onMouseEnter={() => { setFocusedPane('conn'); setConnNavIndex(idx); }}
                                        >
                                            {/* Status Dot */}
                                            {isActive && (
                                                <div className="absolute left-1 w-1 h-4 bg-accent rounded-full animate-in slide-in-from-left duration-300" />
                                            )}

                                            {/* Logo */}
                                            <div className="w-10 h-10 rounded-xl bg-bg-primary/50 flex items-center justify-center p-1.5 shrink-0 border border-border/10 group-hover:scale-105 transition-transform">
                                                <img
                                                    src={provider.icon}
                                                    alt={provider.label}
                                                    className="w-full h-full object-contain"
                                                />
                                            </div>

                                            {/* Details */}
                                            <div className="flex-1 min-w-0">
                                                <div className={cn(
                                                    "font-bold truncate text-[13px] tracking-tight",
                                                    isActive ? "text-accent" : "text-text-primary"
                                                )}>
                                                    {conn.name}
                                                </div>
                                                <div className="text-[10px] text-text-muted truncate mt-0.5 font-medium opacity-60">
                                                    {provider.requiresHost ? `${conn.host}:${conn.port}` : 'Local Project'}
                                                </div>
                                            </div>

                                            {/* Info/Edit */}
                                            <button
                                                className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-bg-secondary text-text-muted transition-all"
                                                onClick={(e) => handleOpenEditConnection(e, conn)}
                                            >
                                                <Info size={14} />
                                            </button>
                                        </div>
                                    );
                                })}
                                {filteredConns.length === 0 && (
                                    <div className={itemEmptyClass}>
                                        No connections found
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Databases pane */}
                        <div className={colClass}>
                            <div className="flex items-center justify-between pr-4 sticky top-0 bg-bg-secondary z-10">
                                <h2 className={paneTitleClass}>Databases</h2>
                                {activeProfile && (
                                    <span className="text-[10px] font-bold text-accent uppercase tracking-widest bg-accent/5 px-2 py-0.5 rounded-full">
                                        Online
                                    </span>
                                )}
                            </div>

                            <div className={filterContainerClass}>
                                <div className="flex flex-1 items-center bg-bg-tertiary/30 px-3 py-2 rounded-xl border border-transparent focus-within:border-accent/30 focus-within:bg-bg-tertiary/50 transition-all">
                                    <Search size={13} className="text-text-muted/50" />
                                    <input 
                                        ref={dbInputRef}
                                        className={searchInputClass} 
                                        placeholder="Filter..." 
                                        value={dbFilter} 
                                        onChange={e => { setDbFilter(e.target.value); setDbNavIndex(0); setFocusedPane('db'); }}
                                        onFocus={() => setFocusedPane('db')}
                                        disabled={!selectedConn}
                                    />
                                </div>
                            </div>

                            <div className={listClass}>
                                {connecting ? (
                                    <div className={cn(itemEmptyClass, 'flex flex-col gap-3')}>
                                        <Spinner size={20} className="text-accent mx-auto" />
                                        <span>Syncing workspace...</span>
                                    </div>
                                ) : connError ? (
                                    <div className={cn(itemEmptyClass, 'text-error/80')}>
                                        <div className="text-xl mb-2">⚠️</div>
                                        {connError}
                                    </div>
                                ) : filteredDbs.length === 0 ? (
                                    <div className={itemEmptyClass}>
                                        {!selectedConn ? 'Select a connection' : databases.length === 0 ? 'No databases available' : 'No matches'}
                                    </div>
                                ) : (
                                    filteredDbs.map((db, idx) => {
                                        const isNavFocus = focusedPane === 'db' && dbNavIndex === idx;
                                        const isActive = activeProfile?.db_name === db;

                                        return (
                                            <div 
                                                key={db} 
                                                ref={isNavFocus ? activeDbRef : undefined}
                                                className={cn(
                                                    "group flex items-center gap-4 px-4 py-3 rounded-xl cursor-pointer transition-all duration-300 mx-1",
                                                    isNavFocus ? "bg-bg-tertiary" : "hover:bg-bg-tertiary/40",
                                                    isActive && "ring-1 ring-accent/40 bg-accent/5"
                                                )} 
                                                onClick={() => handleSelectDb(db)}
                                                onMouseEnter={() => { setFocusedPane('db'); setDbNavIndex(idx); }}
                                            >
                                                {/* Status Dot */}
                                                {isActive && (
                                                    <div className="absolute left-1 w-1 h-4 bg-accent rounded-full animate-in slide-in-from-left duration-300" />
                                                )}

                                                <div className={cn(
                                                    "w-10 h-10 rounded-xl bg-bg-primary/50 flex items-center justify-center p-1.5 shrink-0 border border-border/10 transition-colors",
                                                    isActive ? "text-accent bg-accent/5" : "text-text-muted group-hover:text-text-secondary"
                                                )}>
                                                    <Database size={18} strokeWidth={isActive ? 2 : 1.5} />
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    <div className={cn(
                                                        "font-bold truncate text-[13px] tracking-tight",
                                                        isActive ? "text-accent" : "text-text-primary"
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
                        <div className={cn(colClass, 'border-r border-border/20 max-w-[200px] min-w-[200px]')}>
                            <h2 className={paneTitleClass}>Provider</h2>
                            <ProviderGrid
                                selected={form.selectedProvider}
                                locked={form.isEditing}
                                onSelect={form.handleDriverChange}
                            />
                            <div className="p-4 mt-auto">
                                <button
                                    className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-bg-tertiary text-text-secondary font-bold text-[11px] hover:bg-bg-tertiary/80 transition-all uppercase tracking-widest"
                                    onClick={() => { setView('list'); setEditProfile(null); }}
                                >
                                    <ArrowLeft size={14} /> Back
                                </button>
                            </div>
                        </div>

                        {/* Right — form */}
                        <div className={cn(colClass, 'bg-bg-secondary')}>
                            <div className="flex items-center justify-between px-6 pt-5 pb-2 sticky top-0 bg-bg-secondary z-10">
                                <h2 className="text-[15px] font-bold text-text-primary tracking-tight">
                                    {form.isEditing ? `Edit Connection` : 'New Workspace'}
                                </h2>
                                <button className="p-1.5 rounded-full hover:bg-bg-tertiary text-text-muted transition-colors" onClick={onClose}>
                                    <X size={16} />
                                </button>
                            </div>
                            
                            <div className="flex-1 overflow-y-auto px-2">
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
                    </div>
                )}
            </div>
        </ModalBackdrop>
    );
};
