import React, { useState, useEffect } from 'react';
import { CheckCircle, AlertCircle, Loader, X, ArrowLeft } from 'lucide-react';
import { models } from '../../../wailsjs/go/models';
import { SaveConnection, TestConnection } from '../../../wailsjs/go/app/App';
import { useConnectionStore } from '../../stores/connectionStore';
import { cn } from '../../lib/cn';
import PostgresLogo from '../../assets/images/postgresql-logo-svgrepo-com.svg';
import SqlServerLogo from '../../assets/images/microsoft-sql-server-logo-svgrepo-com.svg';
import MySqlLogo from '../../assets/images/mysql-logo-svgrepo-com.svg';
import SqliteLogo from '../../assets/images/sqlite-svgrepo-com.svg';

type ConnectionProfile = models.ConnectionProfile;

interface ConnectionDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
    profile?: ConnectionProfile | null;
}

// ── Provider catalogue (kept in sync with WorkspaceModal) ────────────────────
interface Provider {
    key: string;
    label: string;
    defaultPort: number | null;
    defaultSsl: string;
    color: string;
    icon: string;
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

// ── Component ────────────────────────────────────────────────────────────────
export const ConnectionDialog: React.FC<ConnectionDialogProps> = ({ isOpen, onClose, onSave, profile }) => {
    const [formData, setFormData] = useState<Partial<ConnectionProfile>>(DEFAULT_FORM());
    const [connString, setConnString] = useState('');
    const [testing, setTesting] = useState(false);
    const [saving, setSaving] = useState(false);
    const [testResult, setTestResult] = useState<'idle' | 'ok' | 'error'>('idle');
    const [errorMsg, setErrorMsg] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    const existingConnections = useConnectionStore(s => s.connections);
    const isEditing = Boolean(profile);

    useEffect(() => {
        if (!isOpen) return;
        setFormData(profile ? { ...profile } : DEFAULT_FORM());
        setConnString('');
        setErrorMsg('');
        setSuccessMsg('');
        setTestResult('idle');
    }, [isOpen, profile]);

    if (!isOpen) return null;

    const selectedProvider = formData.driver ?? 'postgres';
    const isSqlite = selectedProvider === 'sqlite';
    const resetFeedback = () => { setTestResult('idle'); setSuccessMsg(''); setErrorMsg(''); };

    // ── Handlers ──────────────────────────────────────────────────────────────
    const handleDriverChange = (key: string) => {
        if (isEditing) return; // driver locked when editing
        const port = PORT_DEFAULTS[key];
        setFormData(prev => ({ ...prev, driver: key, port: port ?? prev.port }));
        resetFeedback();
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        if (type === 'checkbox') {
            setFormData(prev => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }));
        } else if (name === 'port' || name === 'connect_timeout') {
            setFormData(prev => ({ ...prev, [name]: parseInt(value) || 0 }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
        resetFeedback();
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
            resetFeedback();
        } catch { /* ignore */ }
    };

    const validate = (): string | null => {
        if (!formData.name?.trim()) return 'Profile name is required';
        if (!isEditing && existingConnections.some(c => c.name === formData.name?.trim())) {
            return `"${formData.name.trim()}" already exists`;
        }
        if (!formData.host?.trim() && !isSqlite) return 'Host is required';
        if (!formData.username?.trim() && !isSqlite) return 'Username is required';
        if (!formData.db_name?.trim()) return 'Database name is required';
        if (!isSqlite && (!formData.port || formData.port <= 0)) return 'Port must be a positive number';
        return null;
    };

    const handleTest = async () => {
        const err = validate();
        if (err) { setErrorMsg(err); return; }
        setTesting(true); setErrorMsg(''); setSuccessMsg(''); setTestResult('idle');
        try {
            await TestConnection(new models.ConnectionProfile(formData as any));
            setSuccessMsg('Connection successful!'); setTestResult('ok');
        } catch (err: any) { setErrorMsg(err.toString()); setTestResult('error'); }
        finally { setTesting(false); }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        const err = validate();
        if (err) { setErrorMsg(err); return; }
        setSaving(true); setErrorMsg('');
        try {
            await SaveConnection(new models.ConnectionProfile(formData as any));
            onSave();
            onClose();
        } catch (err: any) { setErrorMsg(err.toString()); }
        finally { setSaving(false); }
    };

    // ── Style tokens ──────────────────────────────────────────────────────────
    const fi = "bg-bg-primary border border-border text-text-primary px-2 py-1 rounded text-[12px] outline-none focus:border-success transition-colors w-full";
    const lbl = "text-[11px] text-text-secondary block mb-0.5";
    const btnBase = "bg-bg-tertiary border border-border text-text-primary px-3 py-1.5 rounded cursor-pointer text-[12px] hover:not-disabled:bg-bg-primary transition-colors disabled:opacity-50 flex items-center justify-center gap-1";
    const btnPrimary = "bg-success text-white border-transparent hover:not-disabled:brightness-110";
    const btnOk = "bg-[#89d185]/15 border-success text-success";
    const btnErr = "bg-[#f48771]/15 border-error text-error";
    const headerClass = "px-4 py-3 bg-bg-tertiary text-[11px] font-semibold uppercase text-text-secondary border-b border-border shrink-0";

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1000]" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="bg-bg-secondary border border-border rounded-lg shadow-[0_8px_32px_rgba(0,0,0,0.5)] w-[580px] h-[420px] flex overflow-hidden">

                {/* Left — provider picker */}
                <div className="flex flex-col border-r border-border min-w-[175px] max-w-[175px]">
                    <div className={headerClass}>Provider</div>

                    <div className="flex-1 overflow-y-auto py-3 bg-bg-primary px-3 grid grid-cols-2 gap-3 content-center">
                        {PROVIDERS.map(p => {
                            const active = selectedProvider === p.key;
                            const locked = isEditing && !active;
                            return (
                                <button
                                    key={p.key}
                                    type="button"
                                    onClick={() => !locked && handleDriverChange(p.key)}
                                    disabled={locked}
                                    title={p.label}
                                    className={cn(
                                        "relative aspect-square flex flex-col items-center justify-center rounded-xl cursor-pointer border transition-all duration-200 select-none p-3",
                                        active
                                            ? "border-success/60 shadow-[0_2px_8px_rgba(0,0,0,0.05)]"
                                            : locked
                                                ? "border-transparent cursor-not-allowed opacity-40 grayscale"
                                                : "border-transparent hover:border-border/80"
                                    )}
                                    style={{ background: `${p.color}${active ? '15' : '08'}` }}
                                >
                                    <img src={p.icon} alt={p.label} className="w-full h-full object-contain drop-shadow-sm transition-transform duration-200 hover:scale-110" />
                                    {active && <span className="absolute -top-1 -right-1 w-3 h-3 border-2 border-bg-secondary rounded-full bg-success shadow-[0_0_4px_rgba(34,197,94,0.6)]" />}
                                </button>
                            );
                        })}
                    </div>

                    {/* Close / back button at bottom */}
                    <div className="px-3 py-2 bg-bg-primary shrink-0">
                        <button
                            type="button"
                            onClick={onClose}
                            className="w-full flex items-center justify-center gap-1.5 border border-border text-text-secondary px-4 py-2 rounded cursor-pointer text-[13px] transition-all duration-100 hover:bg-bg-tertiary hover:text-text-primary"
                        >
                            <X size={13} /> Close
                        </button>
                    </div>
                </div>

                {/* Right — compact form */}
                <div className="flex flex-col flex-1 bg-bg-primary overflow-hidden">
                    <div className={cn(headerClass, "flex items-center justify-between")}>
                        <span>{isEditing ? `Edit — ${profile?.name}` : 'New Connection'}</span>
                    </div>

                    <form onSubmit={handleSave} className="flex-1 overflow-y-auto flex flex-col gap-2.5 px-4 py-3">
                        {/* Connection string — new only */}
                        {!isEditing && (
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
                        )}

                        {/* Profile name */}
                        <div>
                            <label className={lbl}>Profile name <span className="text-error">*</span></label>
                            <input
                                name="name"
                                value={formData.name || ''}
                                onChange={handleChange}
                                placeholder="e.g. Production"
                                autoFocus={!isEditing}
                                disabled={isEditing}
                                className={cn(fi, isEditing && 'opacity-50')}
                            />
                            {isEditing && <span className="text-[10px] text-text-muted">Name cannot be changed after creation</span>}
                        </div>

                        {/* Host + Port */}
                        <div className="flex gap-2">
                            <div className="flex-1" style={{ flex: 3 }}>
                                <label className={lbl}>Host {!isSqlite && <span className="text-error">*</span>}</label>
                                <input name="host" value={formData.host || ''} onChange={handleChange} placeholder="localhost" disabled={isSqlite} className={cn(fi, isSqlite && 'opacity-40')} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <label className={lbl}>Port {!isSqlite && <span className="text-error">*</span>}</label>
                                <input type="number" name="port" value={isSqlite ? '' : (formData.port || '')} onChange={handleChange} min={1} max={65535} disabled={isSqlite} placeholder={isSqlite ? '—' : ''} className={cn(fi, isSqlite && 'opacity-40')} />
                            </div>
                        </div>

                        {/* Username + Password */}
                        <div className="flex gap-2">
                            <div className="flex-1">
                                <label className={lbl}>Username {!isSqlite && <span className="text-error">*</span>}</label>
                                <input name="username" value={formData.username || ''} onChange={handleChange} placeholder={isSqlite ? '—' : 'postgres'} disabled={isSqlite} autoComplete="username" className={cn(fi, isSqlite && 'opacity-40')} />
                            </div>
                            <div className="flex-1">
                                <label className={lbl}>Password</label>
                                <input type="password" name="password" value={formData.password || ''} onChange={handleChange} disabled={isSqlite} autoComplete="current-password" className={cn(fi, isSqlite && 'opacity-40')} />
                            </div>
                        </div>

                        {/* Database + SSL */}
                        <div className="flex gap-2">
                            <div className="flex-1" style={{ flex: 2 }}>
                                <label className={lbl}>Database <span className="text-error">*</span></label>
                                <input name="db_name" value={formData.db_name || ''} onChange={handleChange} placeholder={isSqlite ? '/path/to/file.db' : 'postgres'} className={fi} />
                            </div>
                            {!isSqlite && (
                                <div style={{ flex: 1 }}>
                                    <label className={lbl}>SSL</label>
                                    <select name="ssl_mode" value={formData.ssl_mode || 'disable'} onChange={handleChange} className={fi}>
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
                                    <input type="checkbox" name="show_all_schemas" checked={formData.show_all_schemas ?? false} onChange={handleChange} className="w-3 h-3 cursor-pointer accent-success" />
                                    Show all schemas
                                </label>
                            )}
                            {selectedProvider === 'sqlserver' && (
                                <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-text-secondary select-none">
                                    <input type="checkbox" name="trust_server_cert" checked={formData.trust_server_cert ?? false} onChange={handleChange} className="w-3 h-3 cursor-pointer accent-success" />
                                    Trust server cert
                                </label>
                            )}
                            <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-text-secondary select-none">
                                <input type="checkbox" name="save_password" checked={formData.save_password ?? true} onChange={handleChange} className="w-3 h-3 cursor-pointer accent-success" />
                                Save password
                            </label>
                        </div>

                        {/* Feedback */}
                        {errorMsg && (
                            <div className="flex items-start gap-1.5 px-2.5 py-1.5 rounded text-[11px] text-error bg-[#f48771]/10 border border-[#f48771]/20">
                                <AlertCircle size={12} className="shrink-0 mt-px" />
                                <span className="break-words flex-1">{errorMsg}</span>
                            </div>
                        )}
                        {successMsg && (
                            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[11px] text-success bg-[#89d185]/10 border border-[#89d185]/20">
                                <CheckCircle size={12} className="shrink-0" />
                                <span className="flex-1">{successMsg}</span>
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
                            <button type="button" className={btnBase} onClick={onClose}>Cancel</button>
                            <button type="submit" className={cn(btnBase, btnPrimary)} disabled={saving}>
                                {saving ? 'Saving…' : 'Save'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};
