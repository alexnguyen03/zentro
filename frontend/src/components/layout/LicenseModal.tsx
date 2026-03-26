import React, { useEffect, useState } from 'react';
import { FileText, X } from 'lucide-react';
import { ModalBackdrop, Button } from '../ui';

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
        <ModalBackdrop onClose={onClose}>
            <div
                className="bg-bg-secondary border border-border/10 rounded-[24px] w-[720px] max-w-[calc(100vw-32px)] max-h-[86vh] flex flex-col overflow-hidden text-text-primary animate-in zoom-in-95 duration-200 shadow-2xl"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-border/30">
                    <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-xl bg-accent/10 text-accent flex items-center justify-center">
                            <FileText size={18} />
                        </div>
                        <div>
                            <h2 className="text-[16px] font-bold">License</h2>
                            <p className="text-[11px] text-text-secondary">MIT License</p>
                        </div>
                    </div>
                    <Button variant="ghost" size="icon" className="w-8 h-8 rounded-lg" onClick={onClose}>
                        <X size={14} />
                    </Button>
                </div>

                <div className="px-5 py-4 overflow-y-auto text-left">
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
            </div>
        </ModalBackdrop>
    );
};
