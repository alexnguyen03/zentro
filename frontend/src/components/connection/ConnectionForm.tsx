import React from 'react';
import { CheckCircle, AlertCircle } from 'lucide-react';
import { cn } from '../../lib/cn';
import { getProvider } from '../../lib/providers';
import { DRIVER } from '../../lib/constants';
import { TestResult } from '../../hooks/useConnectionForm';
import { Button, Spinner } from '../ui';
import type { ConnectionProfile } from '../../types/connection';

// ── Style tokens (shared, defined once) ──────────────────────────────────────
export const fi = 'bg-bg-primary border border-border text-text-primary px-2 py-1 rounded text-[12px] outline-none focus:border-success transition-colors w-full';
export const lbl = 'text-[11px] text-text-secondary block mb-0.5';

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
    const provider = getProvider(formData.driver ?? DRIVER.POSTGRES);
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
                        placeholder={`${DRIVER.POSTGRES}://user:pass@host:5432/db`}
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
            <div className="flex flex-col gap-2 sm:flex-row">
                <div className="flex-1 sm:basis-3/4">
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
                <div className="sm:basis-1/4">
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
            <div className="flex flex-col gap-2 sm:flex-row">
                <div className="flex-1">
                    <label className={lbl}>Username {requiresAuth && <span className="text-error">*</span>}</label>
                    <input
                        name="username"
                        value={formData.username || ''}
                        onChange={onChange}
                        placeholder={requiresAuth ? DRIVER.POSTGRES : '—'}
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
            <div className="flex flex-col gap-2 sm:flex-row">
                <div className="flex-1 sm:basis-2/3">
                    <label className={lbl}>Database <span className="text-error">*</span></label>
                    <input
                        name="db_name"
                        value={formData.db_name || ''}
                        onChange={onChange}
                        placeholder={!requiresHost ? '/path/to/file.db' : DRIVER.POSTGRES}
                        className={fi}
                    />
                </div>
                {requiresHost && (
                    <div className="sm:basis-1/3">
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
                <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-text-secondary select-none">
                    <input
                        type="checkbox"
                        name="encrypt_password"
                        checked={formData.encrypt_password ?? true}
                        onChange={onChange}
                        disabled={!(formData.save_password ?? true)}
                        className="w-3 h-3 cursor-pointer accent-success"
                    />
                    Encrypt password
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
            <div className="mt-auto flex gap-1.5 pt-2.5">
                <Button
                    type="button"
                    variant="solid"
                    className={cn(
                        "transition-all",
                        testResult === 'ok' && "bg-[#89d185]/15 border-success text-success hover:bg-[#89d185]/20",
                        testResult === 'error' && "bg-[#f48771]/15 border-error text-error hover:bg-[#f48771]/20"
                    )}
                    onClick={onTest}
                    disabled={testing}
                >
                    {testing
                        ? <><Spinner size={11} className="mr-1" /> Testing…</>
                        : testResult === 'ok'
                            ? <><CheckCircle size={11} className="mr-1" /> OK</>
                            : 'Test'}
                </Button>
                <div className="flex-1" />
                <Button type="submit" variant="success" className="w-6/12 min-w-[120px] sm:min-w-0" disabled={saving}>
                    {saving ? <><Spinner size={11} className="text-white mr-1" /> Saving…</> : 'Save'}
                </Button>
            </div>
        </form>
    );
};
