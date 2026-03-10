import React, { useState, useEffect } from 'react';
import { CheckCircle, AlertCircle, Loader, X } from 'lucide-react';
import { models } from '../../../wailsjs/go/models';
import { SaveConnection, TestConnection, LoadConnections } from '../../../wailsjs/go/app/App';
import { useConnectionStore } from '../../stores/connectionStore';
import { cn } from '../../lib/cn';

type ConnectionProfile = models.ConnectionProfile;

interface ConnectionDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
    profile?: ConnectionProfile | null;  // null = create new
}

const DEFAULT_FORM: Partial<ConnectionProfile> = {
    driver: 'postgres',
    host: 'localhost',
    port: 5432,
    ssl_mode: 'disable',
    connect_timeout: 30,
    save_password: true,
    name: '',
    username: '',
    password: '',
    db_name: '',
    show_all_schemas: false,
    trust_server_cert: false,
};

export const ConnectionDialog: React.FC<ConnectionDialogProps> = ({ isOpen, onClose, onSave, profile }) => {
    const [formData, setFormData] = useState<Partial<ConnectionProfile>>(DEFAULT_FORM);
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
        setFormData(profile ? { ...profile } : { ...DEFAULT_FORM });
        setConnString('');
        setErrorMsg('');
        setSuccessMsg('');
        setTestResult('idle');
    }, [isOpen, profile]);

    if (!isOpen) return null;

    // ── Handlers ─────────────────────────────────────────────────────────

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        if (type === 'checkbox') {
            setFormData(prev => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }));
        } else if (name === 'port' || name === 'connect_timeout') {
            setFormData(prev => ({ ...prev, [name]: parseInt(value) || 0 }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
        // Reset test result when form changes
        setTestResult('idle');
        setSuccessMsg('');
        setErrorMsg('');
    };

    const handleParseConnectionString = (e: React.ChangeEvent<HTMLInputElement>) => {
        const urlStr = e.target.value;
        setConnString(urlStr);

        if (!urlStr.trim()) return;

        try {
            // Need a valid protocol to parse properly
            const toParse = urlStr.includes('://') ? urlStr : `postgres://${urlStr}`;
            const url = new URL(toParse);
            const updates: Partial<ConnectionProfile> = {};

            if (url.protocol.startsWith('postgres')) updates.driver = 'postgres';
            if (url.protocol.startsWith('sqlserver')) updates.driver = 'sqlserver';

            if (url.hostname) updates.host = url.hostname;
            if (url.port) updates.port = parseInt(url.port, 10);

            if (url.pathname) {
                const db = url.pathname.replace(/^\//, '');
                if (db) updates.db_name = db;
            }

            if (url.username) updates.username = decodeURIComponent(url.username);
            if (url.password) updates.password = decodeURIComponent(url.password);

            const sslmode = url.searchParams.get('sslmode');
            if (sslmode) updates.ssl_mode = sslmode;

            // Auto-generate name if it's empty
            if (!formData.name && updates.host) {
                updates.name = `${updates.driver}-${updates.host.split('.')[0]}`;
            }

            setFormData(prev => ({ ...prev, ...updates }));
            setTestResult('idle');
            setSuccessMsg('');
            // Optional: clear the field after pasting
            // setConnString('');
        } catch (err) {
            // Ignore parse errors while typing
        }
    };

    const validate = (): string | null => {
        if (!formData.name?.trim()) return 'Profile name is required';
        if (!isEditing) {
            // Duplicate name check (only for new connections)
            if (existingConnections.some(c => c.name === formData.name?.trim())) {
                return `A connection named "${formData.name.trim()}" already exists`;
            }
        }
        if (!formData.host?.trim()) return 'Host is required';
        if (!formData.username?.trim()) return 'Username is required';
        if (!formData.db_name?.trim()) return 'Database name is required';
        if (!formData.port || formData.port <= 0) return 'Port must be a positive number';
        return null;
    };

    const handleTest = async () => {
        const err = validate();
        if (err) { setErrorMsg(err); return; }

        setTesting(true);
        setErrorMsg('');
        setSuccessMsg('');
        setTestResult('idle');
        try {
            await TestConnection(new models.ConnectionProfile(formData as any));
            setSuccessMsg('Connection successful!');
            setTestResult('ok');
        } catch (err: any) {
            setErrorMsg(err.toString());
            setTestResult('error');
        } finally {
            setTesting(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        const err = validate();
        if (err) { setErrorMsg(err); return; }

        setSaving(true);
        setErrorMsg('');
        try {
            await SaveConnection(new models.ConnectionProfile(formData as any));
            onSave();
            onClose();
        } catch (err: any) {
            setErrorMsg(err.toString());
        } finally {
            setSaving(false);
        }
    };

    const handleOverlayClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) onClose();
    };

    // ── Render ───────────────────────────────────────────────────────────

    const labelClass = "text-xs text-text-secondary";
    const inputClass = "bg-bg-primary border border-border text-text-primary px-3 py-2 rounded text-[13px] outline-none focus:border-success transition-colors w-full";
    const btnClass = "bg-bg-tertiary border border-border text-text-primary px-4 py-2 rounded cursor-pointer text-[13px] hover:not(:disabled):bg-bg-primary transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5";
    const btnPrimaryClass = "bg-success text-white border-transparent hover:not(:disabled):bg-success-hover";
    const btnSuccessClass = "bg-[#89d185]/15 border-success text-success";
    const btnDangerClass = "bg-[#f48771]/15 border-error text-error";

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1000]" onClick={handleOverlayClick}>
            <div className="bg-bg-secondary flex flex-col border border-border rounded-lg shadow-[0_8px_32px_rgba(0,0,0,0.5)] w-[520px] max-h-[90vh] overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0 bg-bg-secondary">
                    <h3 className="m-0 text-sm font-semibold text-text-primary">{isEditing ? `Edit — ${profile?.name}` : 'New Connection'}</h3>
                    <button className="bg-transparent border-none text-text-secondary cursor-pointer p-1 rounded transition-colors hover:text-text-primary hover:bg-bg-tertiary flex items-center justify-center" onClick={onClose} title="Close">
                        <X size={16} />
                    </button>
                </div>

                <form onSubmit={handleSave} className="flex flex-col gap-4 py-5 px-5 overflow-y-auto">
                    {/* Connection String (Only show when adding new, or maybe always) */}
                    {!isEditing && (
                        <div className="flex gap-4 pb-4 border-b border-border mb-1">
                            <div className="flex flex-col gap-1.5 flex-1 w-full">
                                <label className={labelClass}>Paste Connection String (URI)</label>
                                <input
                                    type="text"
                                    value={connString}
                                    onChange={handleParseConnectionString}
                                    placeholder="postgres://user:pass@host:5432/dbname?sslmode=require"
                                    className={cn(inputClass, "font-mono")}
                                />
                                <span className="text-[11px] text-text-secondary -mt-0.5 opacity-80">Auto-fills the fields below</span>
                            </div>
                        </div>
                    )}

                    {/* Profile Name + Driver */}
                    <div className="flex gap-4">
                        <div className="flex flex-col gap-1.5" style={{ flex: 2 }}>
                            <label className={labelClass}>Profile Name <span className="text-error">*</span></label>
                            <input
                                name="name"
                                value={formData.name || ''}
                                onChange={handleChange}
                                placeholder="e.g., Production DB"
                                autoFocus={!isEditing}
                                disabled={isEditing}
                                className={inputClass}
                            />
                            {isEditing && (
                                <span className="text-[11px] text-text-secondary -mt-0.5 opacity-80">Profile name cannot be changed after creation</span>
                            )}
                        </div>
                        <div className="flex flex-col gap-1.5 flex-1 w-full" style={{ flex: 1 }}>
                            <label className={labelClass}>Driver</label>
                            <select name="driver" value={formData.driver || 'postgres'} onChange={handleChange} className={inputClass}>
                                <option value="postgres">PostgreSQL</option>
                                <option value="sqlserver">SQL Server</option>
                            </select>
                        </div>
                    </div>

                    {/* Host + Port */}
                    <div className="flex gap-4">
                        <div className="flex flex-col gap-1.5 flex-1 w-full" style={{ flex: 3 }}>
                            <label className={labelClass}>Host <span className="text-error">*</span></label>
                            <input
                                name="host"
                                value={formData.host || ''}
                                onChange={handleChange}
                                placeholder="localhost"
                                className={inputClass}
                            />
                        </div>
                        <div className="flex flex-col gap-1.5 flex-1 w-full" style={{ flex: 1 }}>
                            <label className={labelClass}>Port <span className="text-error">*</span></label>
                            <input
                                type="number"
                                name="port"
                                value={formData.port || 5432}
                                onChange={handleChange}
                                min={1}
                                max={65535}
                                className={inputClass}
                            />
                        </div>
                    </div>

                    {/* Username + Password */}
                    <div className="flex gap-4">
                        <div className="flex flex-col gap-1.5 flex-1 w-full">
                            <label className={labelClass}>Username <span className="text-error">*</span></label>
                            <input
                                name="username"
                                value={formData.username || ''}
                                onChange={handleChange}
                                placeholder="postgres"
                                autoComplete="username"
                                className={inputClass}
                            />
                        </div>
                        <div className="flex flex-col gap-1.5 flex-1 w-full">
                            <label className={labelClass}>Password</label>
                            <input
                                type="password"
                                name="password"
                                value={formData.password || ''}
                                onChange={handleChange}
                                autoComplete="current-password"
                                className={inputClass}
                            />
                        </div>
                    </div>

                    {/* Database + SSL Mode */}
                    <div className="flex gap-4">
                        <div className="flex flex-col gap-1.5 flex-1 w-full" style={{ flex: 2 }}>
                            <label className={labelClass}>Database <span className="text-error">*</span></label>
                            <input
                                name="db_name"
                                value={formData.db_name || ''}
                                onChange={handleChange}
                                placeholder="postgres"
                                className={inputClass}
                            />
                        </div>
                        <div className="flex flex-col gap-1.5 flex-1 w-full" style={{ flex: 1 }}>
                            <label className={labelClass}>SSL Mode</label>
                            <select name="ssl_mode" value={formData.ssl_mode || 'disable'} onChange={handleChange} className={inputClass}>
                                <option value="disable">Disable</option>
                                <option value="require">Require</option>
                                <option value="verify-ca">Verify CA</option>
                                <option value="verify-full">Verify Full</option>
                            </select>
                        </div>
                    </div>

                    {/* Connect Timeout + Save Password */}
                    <div className="flex gap-4 items-center">
                        <div className="flex flex-col gap-1.5 flex-1 w-full" style={{ flex: 1 }}>
                            <label className={labelClass}>Timeout (seconds)</label>
                            <input
                                type="number"
                                name="connect_timeout"
                                value={formData.connect_timeout ?? 30}
                                onChange={handleChange}
                                min={1}
                                max={300}
                                className={inputClass}
                            />
                        </div>
                        <div className="flex items-end justify-end flex-wrap gap-3" style={{ flex: 2 }}>
                            <label className="flex items-center gap-2 cursor-pointer text-[13px] text-text-secondary select-none">
                                <input
                                    type="checkbox"
                                    name="show_all_schemas"
                                    checked={formData.show_all_schemas ?? false}
                                    onChange={handleChange}
                                    className="w-3.5 h-3.5 cursor-pointer accent-success"
                                />
                                <span title="Show pg_catalog and information_schema (Postgres)">Show all schemas</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer text-[13px] text-text-secondary select-none">
                                <input
                                    type="checkbox"
                                    name="trust_server_cert"
                                    checked={formData.trust_server_cert ?? false}
                                    onChange={handleChange}
                                    className="w-3.5 h-3.5 cursor-pointer accent-success"
                                />
                                <span title="Bypass SSL verification (SQL Server)">Trust server cert</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer text-[13px] text-text-secondary select-none">
                                <input
                                    type="checkbox"
                                    name="save_password"
                                    checked={formData.save_password ?? true}
                                    onChange={handleChange}
                                    className="w-3.5 h-3.5 cursor-pointer accent-success"
                                />
                                <span>Save password</span>
                            </label>
                        </div>
                    </div>

                    {/* Test result feedback */}
                    {errorMsg && (
                        <div className="flex items-center gap-2 px-3 py-2 rounded text-xs text-error bg-[#f48771]/10 border border-[#f48771]/20 mt-1">
                            <AlertCircle size={14} className="shrink-0" />
                            <span className="leading-snug break-words flex-1">{errorMsg}</span>
                        </div>
                    )}
                    {successMsg && (
                        <div className="flex items-center gap-2 px-3 py-2 rounded text-xs text-success bg-[#89d185]/10 border border-[#89d185]/20 mt-1">
                            <CheckCircle size={14} className="shrink-0" />
                            <span className="leading-snug break-words flex-1">{successMsg}</span>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 mt-4 pt-4 border-t border-border shrink-0">
                        <button
                            type="button"
                            className={cn(btnClass, testResult === 'ok' ? btnSuccessClass : testResult === 'error' ? btnDangerClass : '')}
                            onClick={handleTest}
                            disabled={testing}
                            title="Test the connection without saving"
                        >
                            {testing
                                ? <><Loader size={13} className="animate-spin" /> Testing…</>
                                : testResult === 'ok'
                                    ? <><CheckCircle size={13} /> Connected</>
                                    : 'Test Connection'
                            }
                        </button>
                        <div style={{ flex: 1 }} />
                        <button type="button" className={btnClass} onClick={onClose}>Cancel</button>
                        <button type="submit" className={cn(btnClass, btnPrimaryClass)} disabled={saving}>
                            {saving ? 'Saving…' : 'Save'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
