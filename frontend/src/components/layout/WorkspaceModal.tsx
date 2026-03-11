import React, { useEffect, useState, useRef } from 'react';
import ReactDOM from 'react-dom';
import { Loader, Search, ArrowLeft, CheckCircle, AlertCircle, X } from 'lucide-react';
import { useConnectionStore } from '../../stores/connectionStore';
import { Connect, SwitchDatabase, SaveConnection, TestConnection } from '../../../wailsjs/go/app/App';
import { models } from '../../../wailsjs/go/models';
import { cn } from '../../lib/cn';
import PostgresLogo from '../../assets/images/postgresql-logo-svgrepo-com.svg';
import SqlServerLogo from '../../assets/images/microsoft-sql-server-logo-svgrepo-com.svg';
import MySqlLogo from '../../assets/images/mysql-logo-svgrepo-com.svg';
import SqliteLogo from '../../assets/images/sqlite-svgrepo-com.svg';

type ConnectionProfile = models.ConnectionProfile;
type View = 'list' | 'new-connection';

interface WorkspaceModalProps { onClose: () => void; }

// ── Provider catalogue ────────────────────────────────────────────────────────
interface Provider {
    key: string;      // matches ConnectionProfile.driver
    label: string;
    defaultPort: number | null;
    defaultSsl: string;
    color: string;    // accent for the icon bg
    icon: string;     // emoji / single-char fallback
}

const PROVIDERS: Provider[] = [
    { key: 'postgres', label: 'PostgreSQL', defaultPort: 5432, defaultSsl: 'disable', color: '#336791', icon: PostgresLogo },
    { key: 'sqlserver', label: 'SQL Server', defaultPort: 1433, defaultSsl: 'disable', color: '#CC2927', icon: SqlServerLogo },
    { key: 'mysql', label: 'MySQL', defaultPort: 3306, defaultSsl: 'disable', color: '#F29111', icon: MySqlLogo },
    { key: 'sqlite', label: 'SQLite', defaultPort: null, defaultSsl: 'disable', color: '#44A8D1', icon: SqliteLogo },
];

const PORT_DEFAULTS: Record<string, number | null> = Object.fromEntries(
    PROVIDERS.map(p => [p.key, p.defaultPort])
);

const DEFAULT_FORM = (driver = 'postgres'): Partial<ConnectionProfile> => {
    const p = PROVIDERS.find(x => x.key === driver) ?? PROVIDERS[0];
    return {
        driver,
        host: 'localhost',
        port: p.defaultPort ?? 5432,
        ssl_mode: p.defaultSsl,
        connect_timeout: 30,
        save_password: true,
        name: '',
        username: '',
        password: '',
        db_name: '',
        show_all_schemas: false,
        trust_server_cert: false,
    };
};

// ── Main component ────────────────────────────────────────────────────────────
export const WorkspaceModal: React.FC<WorkspaceModalProps> = ({ onClose }) => {
    const { connections, databases, activeProfile } = useConnectionStore();
    const existingConnections = useConnectionStore(s => s.connections);

    const [view, setView] = useState<View>('list');
    const [selectedConn, setSelectedConn] = useState<string>(activeProfile?.name ?? '');
    const [connecting, setConnecting] = useState(false);
    const [connError, setConnError] = useState<string | null>(null);
    const [connFilter, setConnFilter] = useState('');
    const [dbFilter, setDbFilter] = useState('');

    // Form state
    const [formData, setFormData] = useState<Partial<ConnectionProfile>>(DEFAULT_FORM());
    const [connString, setConnString] = useState('');
    const [testing, setTesting] = useState(false);
    const [saving, setSaving] = useState(false);
    const [testResult, setTestResult] = useState<'idle' | 'ok' | 'error'>('idle');
    const [formError, setFormError] = useState('');
    const [formSuccess, setFormSuccess] = useState('');

    const inputRef = useRef<HTMLInputElement>(null);

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

    // ── Form handlers ─────────────────────────────────────────────────────────
    const resetFormFeedback = () => { setTestResult('idle'); setFormSuccess(''); setFormError(''); };

    const handleDriverChange = (key: string) => {
        const port = PORT_DEFAULTS[key];
        setFormData(prev => ({
            ...prev,
            driver: key,
            port: port ?? prev.port,
        }));
        resetFormFeedback();
    };

    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        if (type === 'checkbox') {
            setFormData(prev => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }));
        } else if (name === 'port' || name === 'connect_timeout') {
            setFormData(prev => ({ ...prev, [name]: parseInt(value) || 0 }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
        resetFormFeedback();
    };

    const handleParseConnectionString = (e: React.ChangeEvent<HTMLInputElement>) => {
        const urlStr = e.target.value;
        setConnString(urlStr);
        if (!urlStr.trim()) return;
        try {
            const toParse = urlStr.includes('://') ? urlStr : `postgres://${urlStr}`;
            const url = new URL(toParse);
            const updates: Partial<ConnectionProfile> = {};
            if (url.protocol.startsWith('postgres')) updates.driver = 'postgres';
            if (url.protocol.startsWith('sqlserver')) updates.driver = 'sqlserver';
            if (url.hostname) updates.host = url.hostname;
            if (url.port) updates.port = parseInt(url.port, 10);
            if (url.pathname) { const db = url.pathname.replace(/^\//, ''); if (db) updates.db_name = db; }
            if (url.username) updates.username = decodeURIComponent(url.username);
            if (url.password) updates.password = decodeURIComponent(url.password);
            const sslmode = url.searchParams.get('sslmode');
            if (sslmode) updates.ssl_mode = sslmode;
            if (!formData.name && updates.host) updates.name = `${updates.driver ?? 'pg'}-${updates.host.split('.')[0]}`;
            setFormData(prev => ({ ...prev, ...updates }));
            resetFormFeedback();
        } catch { /* ignore */ }
    };

    const validate = (): string | null => {
        if (!formData.name?.trim()) return 'Profile name is required';
        if (existingConnections.some(c => c.name === formData.name?.trim())) return `"${formData.name.trim()}" already exists`;
        if (!formData.host?.trim() && formData.driver !== 'sqlite') return 'Host is required';
        if (!formData.username?.trim() && formData.driver !== 'sqlite') return 'Username is required';
        if (!formData.db_name?.trim()) return 'Database name is required';
        if (formData.driver !== 'sqlite' && (!formData.port || formData.port <= 0)) return 'Port must be a positive number';
        return null;
    };

    const handleTest = async () => {
        const err = validate();
        if (err) { setFormError(err); return; }
        setTesting(true); setFormError(''); setFormSuccess(''); setTestResult('idle');
        try {
            await TestConnection(new models.ConnectionProfile(formData as any));
            setFormSuccess('Connection successful!'); setTestResult('ok');
        } catch (err: any) { setFormError(err.toString()); setTestResult('error'); }
        finally { setTesting(false); }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        const err = validate();
        if (err) { setFormError(err); return; }
        setSaving(true); setFormError('');
        try {
            await SaveConnection(new models.ConnectionProfile(formData as any));
            setView('list');
            setFormData(DEFAULT_FORM());
            setConnString('');
        } catch (err: any) { setFormError(err.toString()); }
        finally { setSaving(false); }
    };

    const handleOpenNewConnection = () => {
        setFormData(DEFAULT_FORM());
        setConnString(''); setFormError(''); setFormSuccess(''); setTestResult('idle');
        setView('new-connection');
    };

    const filteredConns = connections.filter(c => c.name?.toLowerCase().includes(connFilter.toLowerCase()));
    const filteredDbs = (selectedConn === activeProfile?.name ? databases : []).filter(d => d.toLowerCase().includes(dbFilter.toLowerCase()));

    // ── Style tokens ──────────────────────────────────────────────────────────
    const colClass = "flex-1 flex flex-col overflow-hidden";
    const headerClass = "px-4 py-3 bg-bg-tertiary text-[11px] font-semibold uppercase text-text-secondary border-b border-border shrink-0";
    const filterContainerClass = "px-3 py-2 border-b border-border bg-bg-primary flex items-center shrink-0";
    const searchInputClass = "w-full bg-transparent border-none text-text-primary outline-none text-[13px] px-1 placeholder:text-text-muted";
    const listClass = "flex-1 overflow-y-auto py-2 bg-bg-primary";
    const itemClass = "px-4 py-[7px] cursor-pointer whitespace-nowrap overflow-hidden text-ellipsis transition-colors duration-100 select-none text-[13px] hover:bg-bg-tertiary hover:text-text-primary";
    const itemActiveClass = "bg-bg-hover border-l-[3px] border-l-success text-success font-medium";
    const itemEmptyClass = "p-4 text-text-secondary text-center text-xs";

    // Compact form tokens
    const fi = "bg-bg-primary border border-border text-text-primary px-2 py-1 rounded text-[12px] outline-none focus:border-success transition-colors w-full";
    const lbl = "text-[11px] text-text-secondary block mb-0.5";
    const btnBase = "bg-bg-tertiary border border-border text-text-primary px-3 py-1.5 rounded cursor-pointer text-[12px] hover:not-disabled:bg-bg-primary transition-colors disabled:opacity-50 flex items-center justify-center gap-1";
    const btnPrimary = "bg-success text-white border-transparent hover:not-disabled:brightness-110";
    const btnOk = "bg-[#89d185]/15 border-success text-success";
    const btnErr = "bg-[#f48771]/15 border-error text-error";

    const selectedProvider = formData.driver ?? 'postgres';
    const isSqlite = selectedProvider === 'sqlite';

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
                    /* ── LIST VIEW ────────────────────────────────────────── */
                    <div className="flex flex-1 overflow-hidden">
                        {/* Connections pane */}
                        <div className={cn(colClass, "border-r border-border")}>
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
                                    <div className={cn(itemEmptyClass, "flex items-center justify-center")}>
                                        <Loader size={13} className="mr-2 animate-spin" /> Connecting...
                                    </div>
                                ) : connError ? (
                                    <div className={cn(itemEmptyClass, "text-error")}>{connError}</div>
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
                    /* ── NEW CONNECTION VIEW (two-pane) ────────────────────── */
                    <div className="flex flex-1 overflow-hidden">
                        {/* Left — provider picker */}
                        <div className={cn(colClass, "border-r border-border max-w-[185px] min-w-[185px]")}>
                            <div className={headerClass}>Provider</div>

                            <div className="flex-1 overflow-y-auto py-3 bg-bg-primary px-3 grid grid-cols-2 gap-3 content-center">
                                {PROVIDERS.map(p => (
                                    <button
                                        key={p.key}
                                        type="button"
                                        onClick={() => handleDriverChange(p.key)}
                                        title={p.label}
                                        className={cn(
                                            "relative aspect-square flex flex-col items-center justify-center rounded-xl cursor-pointer border transition-all duration-200 select-none p-3",
                                            selectedProvider === p.key
                                                ? "border-success/60 shadow-[0_2px_8px_rgba(0,0,0,0.05)]"
                                                : "border-transparent hover:border-border/80"
                                        )}
                                        style={{ background: `${p.color}${selectedProvider === p.key ? '15' : '08'}` }}
                                    >
                                        <img src={p.icon} alt={p.label} className="w-full h-full object-contain drop-shadow-sm transition-transform duration-200 hover:scale-110" />
                                        {selectedProvider === p.key && (
                                            <span className="absolute -top-1 -right-1 w-3 h-3 border-2 border-bg-secondary rounded-full bg-success shadow-[0_0_4px_rgba(34,197,94,0.6)]" />
                                        )}
                                    </button>
                                ))}
                            </div>

                            {/* Back button — same position as "New connection" */}
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

                        {/* Right — compact form */}
                        <div className={cn(colClass, "bg-bg-primary")}>
                            <div className={cn(headerClass, "flex items-center justify-between")}>
                                <span>New Connection</span>
                                <button className="text-text-muted hover:text-text-primary transition-colors bg-transparent border-none cursor-pointer p-0.5 rounded" onClick={onClose}>
                                    <X size={12} />
                                </button>
                            </div>

                            <form onSubmit={handleSave} className="flex-1 overflow-y-auto flex flex-col gap-2.5 px-4 py-3">
                                {/* Connection string */}
                                <div className="pb-2.5 border-b border-border">
                                    <label className={lbl}>Connection string (URI)</label>
                                    <input
                                        type="text"
                                        value={connString}
                                        onChange={handleParseConnectionString}
                                        placeholder="postgres://user:pass@host:5432/db"
                                        className={cn(fi, "font-mono text-[11px]")}
                                    />
                                </div>

                                {/* Profile name */}
                                <div>
                                    <label className={lbl}>Profile name <span className="text-error">*</span></label>
                                    <input name="name" value={formData.name || ''} onChange={handleFormChange} placeholder="e.g. Production" autoFocus className={fi} />
                                </div>

                                {/* Host + Port */}
                                <div className="flex gap-2">
                                    <div className="flex-1" style={{ flex: 3 }}>
                                        <label className={lbl}>Host {!isSqlite && <span className="text-error">*</span>}</label>
                                        <input name="host" value={formData.host || ''} onChange={handleFormChange} placeholder="localhost" disabled={isSqlite} className={cn(fi, isSqlite && 'opacity-40')} />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <label className={lbl}>Port {!isSqlite && <span className="text-error">*</span>}</label>
                                        <input type="number" name="port" value={isSqlite ? '' : (formData.port || '')} onChange={handleFormChange} min={1} max={65535} disabled={isSqlite} placeholder={isSqlite ? '—' : ''} className={cn(fi, isSqlite && 'opacity-40')} />
                                    </div>
                                </div>

                                {/* Username + Password */}
                                <div className="flex gap-2">
                                    <div className="flex-1">
                                        <label className={lbl}>Username {!isSqlite && <span className="text-error">*</span>}</label>
                                        <input name="username" value={formData.username || ''} onChange={handleFormChange} placeholder={isSqlite ? '—' : 'postgres'} disabled={isSqlite} autoComplete="username" className={cn(fi, isSqlite && 'opacity-40')} />
                                    </div>
                                    <div className="flex-1">
                                        <label className={lbl}>Password</label>
                                        <input type="password" name="password" value={formData.password || ''} onChange={handleFormChange} disabled={isSqlite} autoComplete="current-password" className={cn(fi, isSqlite && 'opacity-40')} />
                                    </div>
                                </div>

                                {/* Database + SSL */}
                                <div className="flex gap-2">
                                    <div className="flex-1" style={{ flex: 2 }}>
                                        <label className={lbl}>Database <span className="text-error">*</span></label>
                                        <input name="db_name" value={formData.db_name || ''} onChange={handleFormChange} placeholder={isSqlite ? '/path/to/file.db' : 'postgres'} className={fi} />
                                    </div>
                                    {!isSqlite && (
                                        <div style={{ flex: 1 }}>
                                            <label className={lbl}>SSL</label>
                                            <select name="ssl_mode" value={formData.ssl_mode || 'disable'} onChange={handleFormChange} className={fi}>
                                                <option value="disable">Disable</option>
                                                <option value="require">Require</option>
                                                <option value="verify-ca">Verify CA</option>
                                                <option value="verify-full">Verify Full</option>
                                            </select>
                                        </div>
                                    )}
                                </div>

                                {/* Checkboxes */}
                                <div className="flex flex-wrap gap-x-3 gap-y-1.5 pt-0.5">
                                    {!isSqlite && (
                                        <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-text-secondary select-none">
                                            <input type="checkbox" name="show_all_schemas" checked={formData.show_all_schemas ?? false} onChange={handleFormChange} className="w-3 h-3 cursor-pointer accent-success" />
                                            Show all schemas
                                        </label>
                                    )}
                                    {selectedProvider === 'sqlserver' && (
                                        <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-text-secondary select-none">
                                            <input type="checkbox" name="trust_server_cert" checked={formData.trust_server_cert ?? false} onChange={handleFormChange} className="w-3 h-3 cursor-pointer accent-success" />
                                            Trust server cert
                                        </label>
                                    )}
                                    <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-text-secondary select-none">
                                        <input type="checkbox" name="save_password" checked={formData.save_password ?? true} onChange={handleFormChange} className="w-3 h-3 cursor-pointer accent-success" />
                                        Save password
                                    </label>
                                </div>

                                {/* Feedback */}
                                {formError && (
                                    <div className="flex items-start gap-1.5 px-2.5 py-1.5 rounded text-[11px] text-error bg-[#f48771]/10 border border-[#f48771]/20">
                                        <AlertCircle size={12} className="shrink-0 mt-px" />
                                        <span className="break-words flex-1">{formError}</span>
                                    </div>
                                )}
                                {formSuccess && (
                                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[11px] text-success bg-[#89d185]/10 border border-[#89d185]/20">
                                        <CheckCircle size={12} className="shrink-0" />
                                        <span className="flex-1">{formSuccess}</span>
                                    </div>
                                )}

                                {/* Actions */}
                                <div className="flex gap-1.5 mt-auto pt-2.5 border-t border-border">
                                    <button
                                        type="button"
                                        className={cn(btnBase, testResult === 'ok' ? btnOk : testResult === 'error' ? btnErr : '')}
                                        onClick={handleTest}
                                        disabled={testing}
                                    >
                                        {testing ? <><Loader size={11} className="animate-spin" /> Testing…</> : testResult === 'ok' ? <><CheckCircle size={11} /> OK</> : 'Test'}
                                    </button>
                                    <div className="flex-1" />
                                    <button type="button" className={btnBase} onClick={() => setView('list')}>Cancel</button>
                                    <button type="submit" className={cn(btnBase, btnPrimary)} disabled={saving}>
                                        {saving ? 'Saving…' : 'Save'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
};
