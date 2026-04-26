import React from 'react';
import { DatabaseTreePicker } from '../../connection/DatabaseTreePicker';
import { ConnectionForm } from '../../connection/ConnectionForm';
import { ProviderPickerToolbar } from '../../connection/ProviderPickerToolbar';
import { ProviderGrid } from '../../connection/ProviderGrid';
import { getProvider } from '../../../lib/providers';
import type { UseConnectionFormReturn } from '../../../hooks/useConnectionForm';
import type { ConnectionProfile } from '../../../types/connection';

interface EnvConnectionPanelProps {
    connectionMode: 'existing' | 'new';
    isSelectingProvider: boolean;
    providerFilter: string;
    treeRefreshKey: number;
    selectedProfileName: string | null;
    selectedDatabase: string;
    connections: ConnectionProfile[];
    isEditMode: boolean;
    importingConnection: boolean;
    importingFormConnection: boolean;
    deletingConnectionName: string | null;
    form: UseConnectionFormReturn;
    onSelectFromTree: (profile: ConnectionProfile, database: string) => void;
    onImportConnection: () => void | Promise<void>;
    onAddNew: () => void;
    onEditConnection: (profile: ConnectionProfile) => void;
    onDeleteConnection?: (profile: ConnectionProfile) => void;
    onBack: () => void;
    onShowProviderPicker: () => void;
    onProviderFilterChange: (value: string) => void;
    onClearProviderFilter: () => void;
    onImportConnectionToForm: () => void | Promise<void>;
    onProviderSelect: (key: string) => void;
    onCancelForm: () => void;
}

export const EnvConnectionPanel: React.FC<EnvConnectionPanelProps> = ({
    connectionMode,
    isSelectingProvider,
    providerFilter,
    treeRefreshKey,
    selectedProfileName,
    selectedDatabase,
    connections,
    isEditMode,
    importingConnection,
    importingFormConnection,
    deletingConnectionName,
    form,
    onSelectFromTree,
    onImportConnection,
    onAddNew,
    onEditConnection,
    onDeleteConnection,
    onBack,
    onShowProviderPicker,
    onProviderFilterChange,
    onClearProviderFilter,
    onImportConnectionToForm,
    onProviderSelect,
    onCancelForm,
}) => {
    const selectedProvider = React.useMemo(
        () => (form.selectedProvider ? getProvider(form.selectedProvider) : null),
        [form.selectedProvider],
    );

    if (connectionMode === 'existing') {
        return (
            <div className="flex-1 overflow-hidden">
                <DatabaseTreePicker
                    key={treeRefreshKey}
                    onSelect={onSelectFromTree}
                    selectedProfile={selectedProfileName}
                    selectedDatabase={selectedDatabase}
                    connectionsOverride={!isEditMode ? connections : undefined}
                    disableAutoLoad={!isEditMode}
                    onImport={onImportConnection}
                    importing={importingConnection}
                    onAddNew={onAddNew}
                    onEditConnection={onEditConnection}
                    onDeleteConnection={isEditMode ? onDeleteConnection : undefined}
                    deletingConnectionName={isEditMode ? deletingConnectionName : null}
                />
            </div>
        );
    }

    return (
        <div className="relative grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] p-1.5">
            <ProviderPickerToolbar
                isSelectingProvider={isSelectingProvider}
                providerFilter={providerFilter}
                selectedProvider={selectedProvider}
                onBack={onBack}
                onShowProviderPicker={onShowProviderPicker}
                onProviderFilterChange={onProviderFilterChange}
                onClearProviderFilter={onClearProviderFilter}
                onImportConnection={onImportConnectionToForm}
                importingConnection={importingFormConnection}
            />
            {isSelectingProvider ? (
                <div className="h-full min-h-0 rounded-sm p-2">
                    <ProviderGrid
                        selected={form.selectedProvider}
                        locked={form.isEditing}
                        filterText={providerFilter}
                        onSelect={onProviderSelect}
                    />
                </div>
            ) : (
                <div className="h-full overflow-hidden">
                    <div className="mx-auto flex min-h-full w-full max-w-155 items-start justify-center">
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
                                onCancel={onCancelForm}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
