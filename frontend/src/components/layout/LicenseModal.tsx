import React, { useEffect, useState } from 'react';
import { ModalBackdrop, ModalFrame } from '../ui';

interface LicenseModalProps {
    onClose: () => void;
}

export const LicenseModal: React.FC<LicenseModalProps> = ({ onClose }) => {
    const [licenseText, setLicenseText] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let mounted = true;

        const loadLicense = async () => {
            setIsLoading(true);
            setError(null);
            try {
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
        <ModalBackdrop onClose={onClose} contentClassName="flex w-full items-center justify-center p-3">
            <ModalFrame
                title="License"
                subtitle="MIT License"
                onClose={onClose}
                className="w-[720px] max-w-[calc(100vw-32px)] max-h-[86vh] rounded-2xl border border-border/10 shadow-elevation-lg"
                headerClassName="px-6 py-4"
                titleClassName="m-0 text-[16px] font-bold"
                subtitleClassName="text-[11px] text-text-secondary"
                bodyClassName="min-h-0 overflow-y-auto px-5 py-4"
            >
                <div className="text-left">
                    {isLoading && (
                        <div className="text-[12px] text-text-secondary">Loading license...</div>
                    )}
                    {!isLoading && error && (
                        <div className="text-[12px] text-error">
                            Failed to load license. {error}
                        </div>
                    )}
                    {!isLoading && !error && (
                        <pre className="m-0 whitespace-pre-wrap break-words text-[12px] leading-5 text-text-secondary font-mono bg-bg-primary/40 rounded-xl border border-border/20 p-4">
                            {licenseText}
                        </pre>
                    )}
                </div>
            </ModalFrame>
        </ModalBackdrop>
    );
};
