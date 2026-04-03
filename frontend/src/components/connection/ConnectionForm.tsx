import React from 'react';
import { AlertCircle, CheckCircle } from 'lucide-react';
import { cn } from '../../lib/cn';
import { DRIVER } from '../../lib/constants';
import { getProvider } from '../../lib/providers';
import { TestResult } from '../../hooks/useConnectionForm';
import { Button, Checkbox, Input, SelectField, Spinner } from '../ui';
import type { ConnectionProfile } from '../../types/connection';

const fieldInputClass = 'h-8 w-full text-[12px]';
const labelClass = 'mb-0.5 block text-[11px] text-muted-foreground';

interface ConnectionFormProps {
    formData: Partial<ConnectionProfile>;
    connString: string;
    testing: boolean;
    saving: boolean;
    testResult: TestResult;
    errorMsg: string;
    successMsg: string;
    isEditing: boolean;
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
    const emitCheckboxChange = React.useCallback((name: string, checked: boolean) => {
        onChange({
            target: { name, type: 'checkbox', checked, value: checked ? 'on' : 'off' },
        } as React.ChangeEvent<HTMLInputElement>);
    }, [onChange]);

    const provider = getProvider(formData.driver ?? DRIVER.POSTGRES);
    const { requiresHost, requiresAuth, extraFields = [] } = provider;
    const providerLogo = formData.driver ? provider.icon : null;

    return (
        <form onSubmit={onSave} className="relative flex flex-1 flex-col gap-2.5 overflow-y-auto px-4 py-3">
            {providerLogo && (
                <div
                    aria-hidden="true"
                    className="pointer-events-none absolute top-4 right-4 h-72 w-72 bg-contain bg-center bg-no-repeat opacity-[0.15]"
                    style={{ backgroundImage: `url(${providerLogo})` }}
                />
            )}

            {showUriField && (
                <div className="border-b border-border pb-2.5">
                    <label className={labelClass}>Connection string (URI)</label>
                    <Input
                        value={connString}
                        onChange={onConnStringChange}
                        placeholder={`${DRIVER.POSTGRES}://user:pass@host:5432/db`}
                        className={cn(fieldInputClass, 'font-mono text-[11px]')}
                    />
                </div>
            )}

            <div>
                <label className={labelClass}>Profile name <span className="text-destructive">*</span></label>
                <Input
                    name="name"
                    value={formData.name || ''}
                    onChange={onChange}
                    placeholder="e.g. Production"
                    autoFocus={!isEditing}
                    disabled={isEditing}
                    className={cn(fieldInputClass, isEditing && 'opacity-50')}
                />
                {isEditing && (
                    <span className="text-[10px] text-muted-foreground">Name cannot be changed after creation</span>
                )}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
                <div className="flex-1 sm:basis-3/4">
                    <label className={labelClass}>Host {requiresHost && <span className="text-destructive">*</span>}</label>
                    <Input
                        name="host"
                        value={formData.host || ''}
                        onChange={onChange}
                        placeholder="localhost"
                        disabled={!requiresHost}
                        className={cn(fieldInputClass, !requiresHost && 'opacity-40')}
                    />
                </div>
                <div className="sm:basis-1/4">
                    <label className={labelClass}>Port {requiresHost && <span className="text-destructive">*</span>}</label>
                    <Input
                        type="number"
                        name="port"
                        value={requiresHost ? (formData.port || '') : ''}
                        onChange={onChange}
                        min={1}
                        max={65535}
                        disabled={!requiresHost}
                        placeholder={!requiresHost ? '-' : ''}
                        className={cn(fieldInputClass, !requiresHost && 'opacity-40')}
                    />
                </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
                <div className="flex-1">
                    <label className={labelClass}>Username {requiresAuth && <span className="text-destructive">*</span>}</label>
                    <Input
                        name="username"
                        value={formData.username || ''}
                        onChange={onChange}
                        placeholder={requiresAuth ? DRIVER.POSTGRES : '-'}
                        disabled={!requiresAuth}
                        autoComplete="username"
                        className={cn(fieldInputClass, !requiresAuth && 'opacity-40')}
                    />
                </div>
                <div className="flex-1">
                    <label className={labelClass}>Password</label>
                    <Input
                        type="password"
                        name="password"
                        value={formData.password || ''}
                        onChange={onChange}
                        disabled={!requiresAuth}
                        autoComplete="current-password"
                        className={cn(fieldInputClass, !requiresAuth && 'opacity-40')}
                    />
                </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
                <div className="flex-1 sm:basis-2/3">
                    <label className={labelClass}>Database <span className="text-destructive">*</span></label>
                    <Input
                        name="db_name"
                        value={formData.db_name || ''}
                        onChange={onChange}
                        placeholder={!requiresHost ? '/path/to/file.db' : DRIVER.POSTGRES}
                        className={fieldInputClass}
                    />
                </div>
                {requiresHost && (
                    <div className="sm:basis-1/3">
                        <label className={labelClass}>SSL</label>
                        <SelectField
                            name="ssl_mode"
                            value={formData.ssl_mode || 'disable'}
                            onValueChange={(value) => {
                                onChange({
                                    target: { name: 'ssl_mode', value },
                                } as React.ChangeEvent<HTMLSelectElement>);
                            }}
                            className={fieldInputClass}
                        >
                            <option value="disable">Disable</option>
                            <option value="require">Require</option>
                            <option value="verify-ca">Verify CA</option>
                            <option value="verify-full">Verify Full</option>
                        </SelectField>
                    </div>
                )}
            </div>

            <div className="flex flex-wrap gap-x-3 gap-y-1.5 pt-0.5">
                {requiresHost && (
                    <label className="flex cursor-pointer select-none items-center gap-1.5 text-[11px] text-muted-foreground">
                        <Checkbox
                            checked={formData.show_all_schemas ?? false}
                            onCheckedChange={(checked) => emitCheckboxChange('show_all_schemas', checked === true)}
                        />
                        Show all schemas
                    </label>
                )}
                {extraFields.map((field) => (
                    <label key={field.name as string} className="flex cursor-pointer select-none items-center gap-1.5 text-[11px] text-muted-foreground">
                        <Checkbox
                            checked={(formData[field.name] as boolean) ?? false}
                            onCheckedChange={(checked) => emitCheckboxChange(field.name as string, checked === true)}
                        />
                        {field.label}
                    </label>
                ))}
                <label className="flex cursor-pointer select-none items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Checkbox
                        checked={formData.save_password ?? true}
                        onCheckedChange={(checked) => emitCheckboxChange('save_password', checked === true)}
                    />
                    Save password
                </label>
                <label className="flex cursor-pointer select-none items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Checkbox
                        checked={formData.encrypt_password ?? true}
                        onCheckedChange={(checked) => emitCheckboxChange('encrypt_password', checked === true)}
                        disabled={!(formData.save_password ?? true)}
                    />
                    Encrypt password
                </label>
            </div>

            {errorMsg && (
                <div className="flex items-start gap-1.5 rounded-md border border-destructive/20 bg-destructive/10 px-2.5 py-1.5 text-[11px] text-destructive">
                    <AlertCircle size={12} className="mt-px shrink-0" />
                    <span className="flex-1 break-words">{errorMsg}</span>
                </div>
            )}
            {successMsg && (
                <div className="flex items-center gap-1.5 rounded-md border border-success/20 bg-success/10 px-2.5 py-1.5 text-[11px] text-success">
                    <CheckCircle size={12} className="shrink-0" />
                    <span className="flex-1">{successMsg}</span>
                </div>
            )}

            <div className="mt-auto flex gap-1.5 pt-2.5">
                <Button
                    type="button"
                    variant="secondary"
                    className={cn(
                        'transition-all',
                        testResult === 'ok' && 'border-success bg-success/15 text-success hover:bg-success/20',
                        testResult === 'error' && 'border-destructive bg-destructive/15 text-destructive hover:bg-destructive/20',
                    )}
                    onClick={onTest}
                    disabled={testing}
                >
                    {testing
                        ? <><Spinner size={11} className="mr-1" /> Testing...</>
                        : testResult === 'ok'
                            ? <><CheckCircle size={11} className="mr-1" /> OK</>
                            : 'Test'}
                </Button>
                <div className="flex-1" />
                <Button type="button" variant="ghost" onClick={onCancel}>
                    Cancel
                </Button>
                <Button type="submit" variant="default" className="min-w-[120px]" disabled={saving}>
                    {saving ? <><Spinner size={11} className="mr-1 text-white" /> Saving...</> : 'Save'}
                </Button>
            </div>
        </form>
    );
};
