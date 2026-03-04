import React, { useState, useEffect } from 'react';
import { CheckCircle, AlertCircle, Loader, X } from 'lucide-react';
import { models } from '../../../wailsjs/go/models';
import { SaveConnection, TestConnection, LoadConnections } from '../../../wailsjs/go/app/App';
import { useConnectionStore } from '../../stores/connectionStore';

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

    return (
        <div className="dialog-overlay" onClick={handleOverlayClick}>
            <div className="dialog-content connection-dialog">
                <div className="dialog-header">
                    <h3>{isEditing ? `Edit — ${profile?.name}` : 'New Connection'}</h3>
                    <button className="dialog-close-btn" onClick={onClose} title="Close">
                        <X size={16} />
                    </button>
                </div>

                <form onSubmit={handleSave} className="connection-form">
                    {/* Connection String (Only show when adding new, or maybe always) */}
                    {!isEditing && (
                        <div className="form-row" style={{ paddingBottom: 15, borderBottom: '1px solid var(--border-color)', marginBottom: 15 }}>
                            <div className="form-group" style={{ flex: 1 }}>
                                <label>Paste Connection String (URI)</label>
                                <input
                                    type="text"
                                    value={connString}
                                    onChange={handleParseConnectionString}
                                    placeholder="postgres://user:pass@host:5432/dbname?sslmode=require"
                                    style={{ fontFamily: 'var(--font-mono)' }}
                                />
                                <span className="form-hint">Auto-fills the fields below</span>
                            </div>
                        </div>
                    )}

                    {/* Profile Name + Driver */}
                    <div className="form-row">
                        <div className="form-group" style={{ flex: 2 }}>
                            <label>Profile Name <span className="required">*</span></label>
                            <input
                                name="name"
                                value={formData.name || ''}
                                onChange={handleChange}
                                placeholder="e.g., Production DB"
                                autoFocus={!isEditing}
                                disabled={isEditing} // Name is the unique key, not editable
                            />
                            {isEditing && (
                                <span className="form-hint">Profile name cannot be changed after creation</span>
                            )}
                        </div>
                        <div className="form-group" style={{ flex: 1 }}>
                            <label>Driver</label>
                            <select name="driver" value={formData.driver || 'postgres'} onChange={handleChange}>
                                <option value="postgres">PostgreSQL</option>
                                <option value="sqlserver">SQL Server</option>
                            </select>
                        </div>
                    </div>

                    {/* Host + Port */}
                    <div className="form-row">
                        <div className="form-group" style={{ flex: 3 }}>
                            <label>Host <span className="required">*</span></label>
                            <input
                                name="host"
                                value={formData.host || ''}
                                onChange={handleChange}
                                placeholder="localhost"
                            />
                        </div>
                        <div className="form-group" style={{ flex: 1 }}>
                            <label>Port <span className="required">*</span></label>
                            <input
                                type="number"
                                name="port"
                                value={formData.port || 5432}
                                onChange={handleChange}
                                min={1}
                                max={65535}
                            />
                        </div>
                    </div>

                    {/* Username + Password */}
                    <div className="form-row">
                        <div className="form-group">
                            <label>Username <span className="required">*</span></label>
                            <input
                                name="username"
                                value={formData.username || ''}
                                onChange={handleChange}
                                placeholder="postgres"
                                autoComplete="username"
                            />
                        </div>
                        <div className="form-group">
                            <label>Password</label>
                            <input
                                type="password"
                                name="password"
                                value={formData.password || ''}
                                onChange={handleChange}
                                autoComplete="current-password"
                            />
                        </div>
                    </div>

                    {/* Database + SSL Mode */}
                    <div className="form-row">
                        <div className="form-group" style={{ flex: 2 }}>
                            <label>Database <span className="required">*</span></label>
                            <input
                                name="db_name"
                                value={formData.db_name || ''}
                                onChange={handleChange}
                                placeholder="postgres"
                            />
                        </div>
                        <div className="form-group" style={{ flex: 1 }}>
                            <label>SSL Mode</label>
                            <select name="ssl_mode" value={formData.ssl_mode || 'disable'} onChange={handleChange}>
                                <option value="disable">Disable</option>
                                <option value="require">Require</option>
                                <option value="verify-ca">Verify CA</option>
                                <option value="verify-full">Verify Full</option>
                            </select>
                        </div>
                    </div>

                    {/* Connect Timeout + Save Password */}
                    <div className="form-row form-row-footer">
                        <div className="form-group" style={{ flex: 1 }}>
                            <label>Timeout (seconds)</label>
                            <input
                                type="number"
                                name="connect_timeout"
                                value={formData.connect_timeout ?? 30}
                                onChange={handleChange}
                                min={1}
                                max={300}
                            />
                        </div>
                        <div className="form-group form-group-checkbox" style={{ flex: 2, justifyContent: 'flex-end', flexWrap: 'wrap', gap: '12px' }}>
                            <label className="checkbox-label">
                                <input
                                    type="checkbox"
                                    name="show_all_schemas"
                                    checked={formData.show_all_schemas ?? false}
                                    onChange={handleChange}
                                />
                                <span title="Show pg_catalog and information_schema (Postgres)">Show all schemas</span>
                            </label>
                            <label className="checkbox-label">
                                <input
                                    type="checkbox"
                                    name="trust_server_cert"
                                    checked={formData.trust_server_cert ?? false}
                                    onChange={handleChange}
                                />
                                <span title="Bypass SSL verification (SQL Server)">Trust server cert</span>
                            </label>
                            <label className="checkbox-label">
                                <input
                                    type="checkbox"
                                    name="save_password"
                                    checked={formData.save_password ?? true}
                                    onChange={handleChange}
                                />
                                <span>Save password</span>
                            </label>
                        </div>
                    </div>

                    {/* Test result feedback */}
                    {errorMsg && (
                        <div className="dialog-feedback error">
                            <AlertCircle size={14} />
                            <span>{errorMsg}</span>
                        </div>
                    )}
                    {successMsg && (
                        <div className="dialog-feedback success">
                            <CheckCircle size={14} />
                            <span>{successMsg}</span>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="dialog-actions">
                        <button
                            type="button"
                            className={`btn ${testResult === 'ok' ? 'btn-success' : testResult === 'error' ? 'btn-danger' : ''}`}
                            onClick={handleTest}
                            disabled={testing}
                            title="Test the connection without saving"
                        >
                            {testing
                                ? <><Loader size={13} style={{ animation: 'spin 1s linear infinite' }} /> Testing…</>
                                : testResult === 'ok'
                                    ? <><CheckCircle size={13} /> Connected</>
                                    : 'Test Connection'
                            }
                        </button>
                        <div style={{ flex: 1 }} />
                        <button type="button" className="btn" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn primary" disabled={saving}>
                            {saving ? 'Saving…' : 'Save'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
