import React from 'react';
import { Gift, ArrowRight, Download } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ModalBackdrop, ModalFrame, Button } from '../ui';
import { BrowserOpenURL } from '../../../wailsjs/runtime/runtime';
import pkg from '../../../../package.json';

interface UpdateModalProps {
    latestVersion: string;
    changelog: string;
    releaseUrl: string;
    onClose: () => void;
    onDismiss: () => void;
}

export const UpdateModal: React.FC<UpdateModalProps> = ({ 
    latestVersion, 
    changelog, 
    releaseUrl, 
    onClose,
    onDismiss 
}) => {
    const handleDownload = () => {
        BrowserOpenURL(releaseUrl);
        onClose();
    };

    const footer = (
        <div className="flex items-center justify-between gap-3">
            <button
                onClick={onDismiss}
                className="px-4 text-[12px] font-bold text-text-muted transition-colors hover:text-text-primary"
            >
                Skip this version
            </button>
            <div className="flex gap-2">
                <Button variant="ghost" className="h-11 rounded-md px-6 text-[13px]" onClick={onClose}>
                    Later
                </Button>
                <Button className="flex h-11 gap-2 rounded-md bg-success px-8 text-[13px] font-bold text-white hover:bg-success/90" onClick={handleDownload}>
                    <Download size={16} />
                    Download Now
                </Button>
            </div>
        </div>
    );

    return (
        <ModalBackdrop onClose={onClose} contentClassName="flex w-full items-center justify-center p-3">
            <ModalFrame
                title={(
                    <span className="inline-flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-md bg-success/10 text-success">
                            <Gift size={20} />
                        </span>
                        <span>New Update Available</span>
                    </span>
                )}
                subtitle={(
                    <span className="inline-flex items-center gap-2">
                        <span>v{pkg.version}</span>
                        <ArrowRight size={10} />
                        <span className="font-bold text-success">v{latestVersion}</span>
                    </span>
                )}
                onClose={onClose}
                footer={footer}
                className="w-[500px] max-w-[calc(100vw-24px)] max-h-[85vh] rounded-md border border-border/10 shadow-elevation-lg"
                headerClassName="border-b-0 px-6 pb-2 pt-6"
                titleClassName="m-0 text-lg font-bold tracking-tight"
                subtitleClassName="text-[12px] font-medium text-text-muted"
                bodyClassName="min-h-0 flex-1 overflow-y-auto"
                footerClassName="border-t-0 p-6 pt-2"
            >
                <div className="flex-1 overflow-y-auto w-full px-8 py-4 text-[13px] leading-relaxed custom-scrollbar bg-bg-primary/30 mx-6 my-2 rounded-md border border-border/5">
                    <div className="font-bold text-[11px] uppercase tracking-widest text-text-muted mb-3">Release Notes</div>
                    <ReactMarkdown 
                        remarkPlugins={[remarkGfm]}
                        components={{
                            h1: ({node, ...props}) => <h1 className="text-lg font-bold mt-2 mb-4 text-text-primary" {...props} />,
                            h2: ({node, ...props}) => <h2 className="text-[15px] font-bold mt-6 mb-3 text-accent" {...props} />,
                            h3: ({node, ...props}) => <h3 className="text-[14px] font-bold mt-5 mb-2" {...props} />,
                            ul: ({node, ...props}) => <ul className="list-disc pl-5 mb-4 space-y-1 text-text-secondary" {...props} />,
                            li: ({node, ...props}) => <li className="pl-1" {...props} />,
                            a: ({node, ...props}) => <a className="text-accent hover:underline" target="_blank" rel="noreferrer" {...props} />,
                            p: ({node, ...props}) => <p className="mb-4 text-text-secondary" {...props} />,
                            code: ({node, ...props}) => <code className="bg-bg-tertiary px-1 rounded-md text-accent" {...props} />,
                        }}
                    >
                        {changelog}
                    </ReactMarkdown>
                </div>
            </ModalFrame>
        </ModalBackdrop>
    );
};
