import React from 'react';
import { X } from 'lucide-react';
import { models } from '../../../wailsjs/go/models';
import { useConnectionStore } from '../../stores/connectionStore';
import { useConnectionForm } from '../../hooks/useConnectionForm';
import { ProviderGrid } from '../connection/ProviderGrid';
import { ConnectionForm } from '../connection/ConnectionForm';
import { Button } from '../ui';

type ConnectionProfile = models.ConnectionProfile;

interface ConnectionDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
    profile?: ConnectionProfile | null;
}

export const ConnectionDialog: React.FC<ConnectionDialogProps> = ({
    isOpen,
    onClose,
    onSave,
    profile,
}) => {
    const existingConnections = useConnectionStore(s => s.connections);
    const existingNames = existingConnections.map(c => c.name!).filter(Boolean);

    const form = useConnectionForm({
        profile,
        isOpen,
        existingNames,
        onSaved: onSave,
        onClose,
    });

    if (!isOpen) return null;

    const headerClass = 'px-4 py-3 bg-bg-tertiary text-[11px] font-semibold text-text-secondary border-b border-border shrink-0';

    return (
        <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1000]"
            onClick={e => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="bg-bg-secondary border border-border rounded-lg shadow-[0_8px_32px_rgba(0,0,0,0.5)] w-[580px] h-[420px] flex overflow-hidden">

                {/* Left — provider picker */}
                <div className="flex flex-col border-r border-border min-w-[175px] max-w-[175px]">
                    <div className={headerClass}>Provider</div>
                    <ProviderGrid
                        selected={form.selectedProvider}
                        locked={form.isEditing}
                        onSelect={form.handleDriverChange}
                    />
                    <div className="px-3 py-2 bg-bg-primary shrink-0">
                        <Button
                            variant="solid"
                            className="w-full flex items-center justify-center gap-1.5"
                            onClick={onClose}
                        >
                            <X size={13} /> Close
                        </Button>
                    </div>
                </div>

                {/* Right — form */}
                <div className="flex flex-col flex-1 bg-bg-primary overflow-hidden">
                    <div className={`${headerClass} flex items-center justify-between`}>
                        <span>{form.isEditing ? `Edit — ${profile?.name}` : 'New Connection'}</span>
                    </div>
                    <ConnectionForm
                        formData={form.formData}
                        connString={form.connString}
                        testing={form.testing}
                        saving={form.saving}
                        testResult={form.testResult}
                        errorMsg={form.errorMsg}
                        successMsg={form.successMsg}
                        isEditing={form.isEditing}
                        showUriField={!form.isEditing}
                        onChange={form.handleChange}
                        onConnStringChange={form.handleParseConnectionString}
                        onTest={form.handleTest}
                        onSave={form.handleSave}
                        onCancel={onClose}
                    />
                </div>
            </div>
        </div>
    );
};
