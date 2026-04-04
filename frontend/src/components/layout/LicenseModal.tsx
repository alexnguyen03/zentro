import React, { useEffect, useState } from 'react';
import { Modal } from '../ui';
import { getLicenseState } from '../../features/license/service';
import { FeatureGate } from '../../features/license/featureGate';
import type { LicenseState } from '../../features/license/types';

interface LicenseModalProps {
    onClose: () => void;
}

export const LicenseModal: React.FC<LicenseModalProps> = ({ onClose }) => {
    const [licenseText, setLicenseText] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [licenseState, setLicenseState] = useState<LicenseState | null>(null);

    useEffect(() => {
        let mounted = true;

        const loadLicense = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const licenseStateResult = await getLicenseState();
                if (licenseStateResult.ok) {
                    setLicenseState(licenseStateResult.data);
                }

                const response = await fetch('/LICENSE.txt', { cache: 'no-cache' });
                if (!response.ok) {
                    throw new Error(`Could not load license file (${response.status})`);
                }
                const content = await response.text();
                if (!mounted) return;
                setLicenseText(content);
            } catch (err) {
                if (!mounted) return;
                setError(String(err));
            } finally {
                if (!mounted) return;
                setIsLoading(false);
            }
        };

        void loadLicense();
        return () => {
            mounted = false;
        };
    }, []);

    return (
        <Modal
            isOpen
            onClose={onClose}
            title={(
                <div className="flex flex-col">
                    <span className="text-[16px] font-bold">License</span>
                    <span className="text-[11px] text-muted-foreground">MIT License</span>
                </div>
            )}
            width={720}
            className="max-h-[86vh] rounded-md border border-border/10 shadow-elevation-lg"
        >
            <div className="min-h-0 overflow-y-auto px-1 py-1">
                <div className="text-left">
                    {licenseState && (
                        <div className="mb-3 rounded-md border border-border/30 bg-background/30 p-3 text-[11px] text-muted-foreground">
                            <div>Status: <span className="font-semibold text-foreground">{licenseState.status}</span></div>
                            <div>
                                Plugin Commands: {new FeatureGate(licenseState).canUse('plugin.ui.commands') ? 'Enabled' : 'Disabled'}
                            </div>
                        </div>
                    )}
                    {isLoading && (
                        <div className="text-[12px] text-muted-foreground">Loading license...</div>
                    )}
                    {!isLoading && error && (
                        <div className="text-[12px] text-error">
                            Failed to load license. {error}
                        </div>
                    )}
                    {!isLoading && !error && (
                        <pre className="m-0 whitespace-pre-wrap break-words text-[12px] leading-5 text-muted-foreground font-mono bg-background/40 rounded-md border border-border/20 p-4">
                            {licenseText}
                        </pre>
                    )}
                </div>
            </div>
        </Modal>
    );
};
