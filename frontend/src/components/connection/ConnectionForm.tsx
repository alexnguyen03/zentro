import React from 'react';
import { CheckCircle, AlertCircle, Loader } from 'lucide-react';
import { cn } from '../../lib/cn';
import { getProvider } from '../../lib/providers';
import { TestResult } from '../../hooks/useConnectionForm';
import { models } from '../../../wailsjs/go/models';

type ConnectionProfile = models.ConnectionProfile;

// ── Style tokens (shared, defined once) ──────────────────────────────────────
export const fi = 'bg-bg-primary border border-border text-text-primary px-2 py-1 rounded text-[12px] outline-none focus:border-success transition-colors w-full';
export const lbl = 'text-[11px] text-text-secondary block mb-0.5';
export const btnBase = 'bg-bg-tertiary border border-border text-text-primary px-3 py-1.5 rounded cursor-pointer text-[12px] transition-colors disabled:opacity-50 flex items-center justify-center gap-1';
export const btnPrimary = 'bg-success text-white border-transparent w-6/12 hover:not-disabled:brightness-110';
export const btnOk = 'bg-[#89d185]/15 border-success text-success';
export const btnErr = 'bg-[#f48771]/15 border-error text-error';

interface ConnectionFormProps {
    formData: Partial<ConnectionProfile>;
    connString: string;
    testing: boolean;
    saving: boolean;
    testResult: TestResult;
    errorMsg: string;
    successMsg: string;
    isEditing: boolean;
    /** When true the connection-string URI field is shown at the top */
    showUriField?: boolean;
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
    onConnStringChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onTest: () => void;
    onSave: (e: React.FormEvent) => void;
    onCancel: () => void;
}

export const ConnectionForm: React.FC<ConnectionFormProps> = ({
    formData,
    connString,
    testing,
    saving,
    testResult,
    errorMsg,
    successMsg,
    isEditing,
    showUriField = false,
    onChange,
    onConnStringChange,
    onTest,
    onSave,
    onCancel,
}) => {
    // Derive capabilities from provider registry — no hardcoded strings in JSX
    const provider = getProvider(formData.driver ?? 'postgres');
    const { requiresHost, requiresAuth, extraFields = [] } = provider;

    return (
        <form onSubmit={onSave} className="flex-1 overflow-y-auto flex flex-col gap-2.5 px-4 py-3">

            {/* URI — new connections only */}
            {showUriField && (
                <div className="pb-2.5 border-b border-border">
                    <label className={lbl}>Connection string (URI)</label>
                    <input
                        type="text"
                        value={connString}
                        onChange={onConnStringChange}
                        placeholder="postgres://user:pass@host:5432/db"
                        className={cn(fi, 'font-mono text-[11px]')}
                    />
                </div>
            )}

            {/* Profile name */}
            <div>
                <label className={lbl}>Profile name <span className="text-error">*</span></label>
                <input
                    name="name"
                    value={formData.name || ''}
                    onChange={onChange}
                    placeholder="e.g. Production"
                    autoFocus={!isEditing}
                    disabled={isEditing}
                    className={cn(fi, isEditing && 'opacity-50')}
                />
                {isEditing && (
                    <span className="text-[10px] text-text-muted">Name cannot be changed after creation</span>
                )}
            </div>

            {/* Host + Port */}
            <div className="flex gap-2">
                <div className="flex-1" style={{ flex: 3 }}>
                    <label className={lbl}>Host {requiresHost && <span className="text-error">*</span>}</label>
                    <input
                        name="host"
                        value={formData.host || ''}
                        onChange={onChange}
                        placeholder="localhost"
                        disabled={!requiresHost}
                        className={cn(fi, !requiresHost && 'opacity-40')}
                    />
                </div>
                <div style={{ flex: 1 }}>
                    <label className={lbl}>Port {requiresHost && <span className="text-error">*</span>}</label>
                    <input
                        type="number"
                        name="port"
                        value={requiresHost ? (formData.port || '') : ''}
                        onChange={onChange}
                        min={1}
                        max={65535}
                        disabled={!requiresHost}
                        placeholder={!requiresHost ? '—' : ''}
                        className={cn(fi, !requiresHost && 'opacity-40')}
                    />
                </div>
            </div>

            {/* Username + Password */}
            <div className="flex gap-2">
                <div className="flex-1">
                    <label className={lbl}>Username {requiresAuth && <span className="text-error">*</span>}</label>
                    <input
                        name="username"
                        value={formData.username || ''}
                        onChange={onChange}
                        placeholder={requiresAuth ? 'postgres' : '—'}
                        disabled={!requiresAuth}
                        autoComplete="username"
                        className={cn(fi, !requiresAuth && 'opacity-40')}
                    />
                </div>
                <div className="flex-1">
                    <label className={lbl}>Password</label>
                    <input
                        type="password"
                        name="password"
                        value={formData.password || ''}
                        onChange={onChange}
                        disabled={!requiresAuth}
                        autoComplete="current-password"
                        className={cn(fi, !requiresAuth && 'opacity-40')}
                    />
                </div>
            </div>

            {/* Database + SSL */}
            <div className="flex gap-2">
                <div className="flex-1" style={{ flex: 2 }}>
                    <label className={lbl}>Database <span className="text-error">*</span></label>
                    <input
                        name="db_name"
                        value={formData.db_name || ''}
                        onChange={onChange}
                        placeholder={!requiresHost ? '/path/to/file.db' : 'postgres'}
                        className={fi}
                    />
                </div>
                {requiresHost && (
                    <div style={{ flex: 1 }}>
                        <label className={lbl}>SSL</label>
                        <select name="ssl_mode" value={formData.ssl_mode || 'disable'} onChange={onChange} className={fi}>
                            <option value="disable">Disable</option>
                            <option value="require">Require</option>
                            <option value="verify-ca">Verify CA</option>
                            <option value="verify-full">Verify Full</option>
                        </select>
                    </div>
                )}
            </div>

            {/* Checkboxes — common + provider-specific via extraFields */}
            <div className="flex flex-wrap gap-x-3 gap-y-1.5 pt-0.5">
                {requiresHost && (
                    <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-text-secondary select-none">
                        <input
                            type="checkbox"
                            name="show_all_schemas"
                            checked={formData.show_all_schemas ?? false}
                            onChange={onChange}
                            className="w-3 h-3 cursor-pointer accent-success"
                        />
                        Show all schemas
                    </label>
                )}
                {/* Provider-specific extra fields from registry */}
                {extraFields.map(field => (
                    <label key={field.name as string} className="flex items-center gap-1.5 cursor-pointer text-[11px] text-text-secondary select-none">
                        <input
                            type="checkbox"
                            name={field.name as string}
                            checked={(formData[field.name] as boolean) ?? false}
                            onChange={onChange}
                            className="w-3 h-3 cursor-pointer accent-success"
                        />
                        {field.label}
                    </label>
                ))}
                <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-text-secondary select-none">
                    <input
                        type="checkbox"
                        name="save_password"
                        checked={formData.save_password ?? true}
                        onChange={onChange}
                        className="w-3 h-3 cursor-pointer accent-success"
                    />
                    Save password
                </label>
            </div>

            {/* Feedback */}
            {errorMsg && (
                <div className="flex items-start gap-1.5 px-2.5 py-1.5 rounded text-[11px] text-error bg-[#f48771]/10 border border-[#f48771]/20">
                    <AlertCircle size={12} className="shrink-0 mt-px" />
                    <span className="wrap-break-word flex-1">{errorMsg}</span>
                </div>
            )}
            {successMsg && (
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[11px] text-success bg-[#89d185]/10 border border-[#89d185]/20">
                    <CheckCircle size={12} className="shrink-0" />
                    <span className="flex-1">{successMsg}</span>
                </div>
            )}

            {/* Actions */}
            <div className="flex gap-1.5 mt-auto pt-2.5">
                <button
                    type="button"
                    className={cn(btnBase, testResult === 'ok' ? btnOk : testResult === 'error' ? btnErr : '')}
                    onClick={onTest}
                    disabled={testing}
                >
                    {testing
                        ? <><Loader size={11} className="animate-spin" /> Testing…</>
                        : testResult === 'ok'
                            ? <><CheckCircle size={11} /> OK</>
                            : 'Test'}
                </button>
                <div className="flex-1" />
                <button type="submit" className={cn(btnBase, btnPrimary)} disabled={saving}>
                    {saving ? 'Saving…' : 'Save'}
                </button>
            </div>
        </form>
    );
};
