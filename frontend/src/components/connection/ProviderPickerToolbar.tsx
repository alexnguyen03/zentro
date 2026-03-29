import React from 'react';
import { ArrowLeft, Settings2, Upload, X } from 'lucide-react';
import { cn } from '../../lib/cn';
import type { ProviderConfig } from '../../lib/providers';
import { Spinner } from '../ui';

interface ProviderPickerToolbarProps {
    isSelectingProvider: boolean;
    providerFilter: string;
    selectedProvider: ProviderConfig | null;
    onBack: () => void;
    onShowProviderPicker: () => void;
    onProviderFilterChange: (value: string) => void;
    onClearProviderFilter: () => void;
    onImportConnection?: () => void | Promise<void>;
    importingConnection?: boolean;
    importDisabled?: boolean;
    className?: string;
}

export const ProviderPickerToolbar: React.FC<ProviderPickerToolbarProps> = ({
    isSelectingProvider,
    providerFilter,
    selectedProvider,
    onBack,
    onShowProviderPicker,
    onProviderFilterChange,
    onClearProviderFilter,
    onImportConnection,
    importingConnection = false,
    importDisabled = false,
    className,
}) => (
    <div className={cn('flex items-center justify-between gap-2 border-b border-border/15 px-1 pb-2', className)}>
        <button
            type="button"
            onClick={onBack}
            className="cursor-pointer inline-flex items-center gap-1 rounded-md border border-border/30 bg-bg-primary/40 p-2 text-[11px] font-semibold text-text-secondary transition-colors hover:bg-bg-primary hover:text-text-primary"
            title="Back"
        >
            <ArrowLeft size={12} />
        </button>
        {selectedProvider && !isSelectingProvider && (
            <div className="flex items-center gap-1">
                {onImportConnection && (
                    <button
                        type="button"
                        onClick={() => {
                            void onImportConnection();
                        }}
                        disabled={importDisabled || importingConnection}
                        className={cn(
                            'inline-flex items-center gap-1 rounded-md border border-border/30 bg-bg-primary/40 p-2 text-[11px] font-semibold text-text-secondary transition-colors',
                            importDisabled || importingConnection
                                ? 'cursor-not-allowed opacity-50'
                                : 'cursor-pointer hover:bg-bg-primary hover:text-text-primary',
                        )}
                        title="Import connection"
                    >
                        {importingConnection ? <Spinner size={12} /> : <Upload size={12} />}
                    </button>
                )}
                <button
                    type="button"
                    onClick={onShowProviderPicker}
                    className="cursor-pointer inline-flex items-center gap-1 rounded-md border border-border/30 bg-bg-primary/40 p-2 text-[11px] font-semibold text-text-secondary transition-colors hover:bg-bg-primary hover:text-text-primary"
                    title={`Change provider (${selectedProvider.label})`}
                >
                    <Settings2 size={12} className="" />
                </button>
            </div>
        )}

        {isSelectingProvider && (
            <div className="flex min-w-0 flex-1 items-center gap-1.5">
                <input
                    type="text"
                    value={providerFilter}
                    onChange={(event) => onProviderFilterChange(event.target.value)}
                    placeholder="Filter providers..."
                    className="w-full rounded-md border border-border bg-bg-primary px-2 py-1 text-[11px] text-text-primary outline-none transition-colors placeholder:text-text-secondary/60 focus:border-success"
                />
                {providerFilter && (
                    <button
                        type="button"
                        onClick={onClearProviderFilter}
                        className="cursor-pointer"
                        title="Clear"
                    >
                        <X size={12} />
                    </button>
                )}
            </div>
        )}
    </div>
);
