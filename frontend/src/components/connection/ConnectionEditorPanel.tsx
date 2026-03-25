import React from 'react';
import type { UseConnectionFormReturn } from '../../hooks/useConnectionForm';
import { cn } from '../../lib/cn';
import { ConnectionForm } from './ConnectionForm';
import { ProviderGrid } from './ProviderGrid';

interface ConnectionEditorPanelProps {
    form: UseConnectionFormReturn;
    onCancel: () => void;
    className?: string;
}

export const ConnectionEditorPanel: React.FC<ConnectionEditorPanelProps> = ({ form, onCancel, className }) => {
    return (
        <div
            className={cn(
                'grid h-full min-h-0 grid-cols-1 grid-rows-[132px_minmax(0,1fr)] overflow-hidden rounded-lg bg-bg-primary/20 xl:grid-cols-[minmax(0,1fr)_200px] xl:grid-rows-1',
                className,
            )}
        >
            <div className="order-2 min-h-0 overflow-y-auto px-4 py-3 xl:order-1">
                <div className="mx-auto flex min-h-full w-full max-w-[620px] items-start justify-center">
                    <div className="w-full">
                        <ConnectionForm
                            formData={form.formData}
                            connString={form.connString}
                            testing={form.testing}
                            saving={form.saving}
                            testResult={form.testResult}
                            errorMsg={form.errorMsg}
                            successMsg={form.successMsg}
                            isEditing={form.isEditing}
                            showUriField={true}
                            onChange={form.handleChange}
                            onConnStringChange={form.handleParseConnectionString}
                            onTest={form.handleTest}
                            onSave={form.handleSave}
                            onCancel={onCancel}
                        />
                    </div>
                </div>
            </div>
            <div className="order-1 min-h-0 overflow-hidden border-b border-border/20 bg-bg-primary/20 px-3 py-3 xl:order-2 xl:border-b-0 xl:border-l">
                <div className="pb-2 text-[11px] font-semibold text-text-secondary">Provider</div>
                <ProviderGrid
                    selected={form.selectedProvider}
                    locked={form.isEditing}
                    onSelect={form.handleDriverChange}
                />
            </div>
        </div>
    );
};
