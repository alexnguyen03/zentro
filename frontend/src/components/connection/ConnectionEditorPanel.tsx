import React from 'react';
import { ChevronsUpDown, Upload } from 'lucide-react';
import type { UseConnectionFormReturn } from '../../hooks/useConnectionForm';
import { cn } from '../../lib/cn';
import { getProvider } from '../../lib/providers';
import { ImportConnectionPackage } from '../../services/connectionService';
import type { ConnectionProfile } from '../../types/connection';
import { Button, Spinner } from '../ui';
import { useToast } from '../layout/Toast';
import { ConnectionForm } from './ConnectionForm';
import { ProviderGrid } from './ProviderGrid';

interface ConnectionEditorPanelProps {
    form: UseConnectionFormReturn;
    onCancel: () => void;
    className?: string;
}

export const ConnectionEditorPanel: React.FC<ConnectionEditorPanelProps> = ({ form, onCancel, className }) => {
    const [isSelectingProvider, setIsSelectingProvider] = React.useState(!form.isEditing);
    const [importing, setImporting] = React.useState(false);
    const { toast } = useToast();
    const selectedProvider = React.useMemo(
        () => (form.selectedProvider ? getProvider(form.selectedProvider) : null),
        [form.selectedProvider],
    );

    const handleProviderSelect = React.useCallback((key: string) => {
        form.handleDriverChange(key);
        if (!form.isEditing) {
            setIsSelectingProvider(false);
        }
    }, [form.handleDriverChange, form.isEditing]);

    const handleOpenProviderPicker = React.useCallback(() => {
        if (!form.isEditing) {
            setIsSelectingProvider(true);
        }
    }, [form.isEditing]);

    const handleImportConnection = React.useCallback(async () => {
        if (form.isEditing) return;

        setImporting(true);
        try {
            const imported = await ImportConnectionPackage();
            if (!imported) return;

            form.setFormFromProfile(imported as ConnectionProfile);
            setIsSelectingProvider(false);
            toast.success(`Imported connection "${imported.name}".`);
        } catch (error) {
            toast.error(`Could not import connection: ${error}`);
        } finally {
            setImporting(false);
        }
    }, [form, toast]);

    return (
        <div
            className={cn(
                'grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-md bg-background/20',
                className,
            )}
        >
            <div className="flex items-center justify-between border-b border-border/20 bg-background/20 px-4 py-3">
                <div>
                    <div className="text-[11px] font-semibold text-muted-foreground">Provider</div>
                    <div className="mt-0.5 text-[12px] text-foreground">
                        {isSelectingProvider ? 'Choose a database driver to continue' : 'Driver selected'}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        type="button"
                        variant="secondary"
                        size="icon"
                        onClick={() => {
                            void handleImportConnection();
                        }}
                        disabled={form.isEditing || importing}
                        className="h-9 w-9 rounded-md border-border/40 bg-background/60 text-muted-foreground hover:bg-background hover:text-foreground"
                        title={form.isEditing ? 'Import disabled while editing' : 'Import connection package'}
                    >
                        {importing ? <Spinner size={13} /> : <Upload size={14} />}
                    </Button>

                    {!isSelectingProvider && (
                        <Button
                            type="button"
                            variant="secondary"
                            size="icon"
                            onClick={handleOpenProviderPicker}
                            disabled={form.isEditing}
                            className={cn(
                                'h-9 w-9 rounded-md border border-border/40 bg-background/60 transition-colors',
                                form.isEditing
                                    ? 'cursor-not-allowed opacity-50'
                                    : 'cursor-pointer hover:border-border hover:bg-background',
                            )}
                            title={form.isEditing ? selectedProvider?.label || 'Provider' : 'Change provider'}
                        >
                            {selectedProvider ? (
                                <img
                                    src={selectedProvider.icon}
                                    alt={selectedProvider.label}
                                    className="h-5 w-5 object-contain"
                                />
                            ) : (
                                <ChevronsUpDown size={14} />
                            )}
                        </Button>
                    )}
                </div>

                {isSelectingProvider && (
                    <div className="flex h-9 items-center gap-2 rounded-md border border-border/30 bg-background/50 px-2.5 text-[11px] text-muted-foreground">
                        {selectedProvider ? (
                            <img
                                src={selectedProvider.icon}
                                alt={selectedProvider.label}
                                className="h-4 w-4 object-contain"
                            />
                        ) : (
                            <span className="font-semibold uppercase tracking-[0.08em]">All</span>
                        )}
                        <ChevronsUpDown size={13} />
                    </div>
                )}
            </div>

            <div className="min-h-0 overflow-hidden">
                {isSelectingProvider ? (
                    <div className="mx-auto flex h-full w-full flex-col px-4 py-4">
                        <div className="pb-3 text-[12px] text-muted-foreground">
                            Select one driver, then the connection form will appear.
                        </div>
                        <ProviderGrid
                            selected={form.selectedProvider}
                            locked={form.isEditing}
                            onSelect={handleProviderSelect}
                        />
                    </div>
                ) : (
                    <div className="h-full overflow-y-auto px-4 py-3">
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
                )}
            </div>
        </div>
    );
};
