import React from 'react';
import { ArrowLeft, Search, Settings2, Upload, X } from 'lucide-react';
import { cn } from '../../lib/cn';
import type { ProviderConfig } from '../../lib/providers';
import { Button, Input, Spinner } from '../ui';

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
        <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onBack}
            className='h-8 w-8 border-border/30 bg-background/40 text-[11px] font-semibold text-muted-foreground hover:bg-background hover:text-foreground'
            title="Back"
        >
            <ArrowLeft size={12} />
        </Button>
        {selectedProvider && !isSelectingProvider && (
            <div className="flex items-center gap-1">
                {onImportConnection && (
                    <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => {
                            void onImportConnection();
                        }}
                        disabled={importDisabled || importingConnection}
                        className={cn(
                            'inline-flex items-center gap-1 rounded-sm border border-border/30 bg-background/40 p-2 text-[11px] font-semibold text-muted-foreground transition-colors',
                            importDisabled || importingConnection
                                ? 'cursor-not-allowed opacity-50'
                                : 'cursor-pointer hover:bg-background hover:text-foreground',
                        )}
                        title="Import connection"
                    >
                        {importingConnection ? <Spinner size={12} /> : <Upload size={12} />}
                    </Button>
                )}
                <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={onShowProviderPicker}
                    className="h-8 w-8 border-border/30 bg-background/40 text-[11px] font-semibold text-muted-foreground hover:bg-background hover:text-foreground"
                    title={`Change provider (${selectedProvider.label})`}
                >
                    <Settings2 size={12} className="" />
                </Button>
            </div>
        )}

        {isSelectingProvider && (
            <div className="flex min-w-0 flex-1 items-center gap-1.5">
                <div className="relative min-w-0 flex-1">
                    <Search size={12} className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-muted-foreground/80" />
                    <Input
                        type="text"
                        value={providerFilter}
                        onChange={(event) => onProviderFilterChange(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === 'Escape') onClearProviderFilter();
                        }}
                        placeholder="Filter providers..."
                        className="w-full pr-2 pl-7 placeholder:text-muted-foreground/70"
                    />
                </div>
                {providerFilter && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={onClearProviderFilter}
                        className="h-7 w-7"
                        title="Clear"
                    >
                        <X size={12} />
                    </Button>
                )}
            </div>
        )}
    </div>
);
