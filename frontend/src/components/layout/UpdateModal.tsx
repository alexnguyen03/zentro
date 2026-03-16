import React from 'react';
import { X, Gift, ArrowRight, Download, ExternalLink } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ModalBackdrop, Button } from '../ui';
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

    return (
        <ModalBackdrop onClose={onClose}>
            <div
                className="bg-bg-secondary border border-border/10 rounded-[32px] w-[500px] max-h-[85vh] flex flex-col overflow-hidden text-text-primary animate-in zoom-in-95 duration-300 shadow-2xl"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-6 pb-2">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-success/10 flex items-center justify-center text-success">
                            <Gift size={20} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold tracking-tight">New Update Available</h2>
                            <div className="flex items-center gap-2 text-[12px] font-medium text-text-muted mt-0.5">
                                <span>v{pkg.version}</span>
                                <ArrowRight size={10} />
                                <span className="text-success font-bold">v{latestVersion}</span>
                            </div>
                        </div>
                    </div>
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="w-8 h-8 rounded-xl hover:bg-bg-tertiary/60" 
                        onClick={onClose}
                    >
                        <X size={16} />
                    </Button>
                </div>

                {/* Changelog Content */}
                <div className="flex-1 overflow-y-auto w-full px-8 py-4 text-[13px] leading-relaxed custom-scrollbar bg-bg-primary/30 mx-6 my-2 rounded-2xl border border-border/5">
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
                            code: ({node, ...props}) => <code className="bg-bg-tertiary px-1 rounded text-accent" {...props} />,
                        }}
                    >
                        {changelog}
                    </ReactMarkdown>
                </div>

                {/* Footer */}
                <div className="p-6 pt-2 flex items-center justify-between gap-3">
                    <button 
                        onClick={onDismiss}
                        className="text-[12px] font-bold text-text-muted hover:text-text-primary transition-colors px-4"
                    >
                        Skip this version
                    </button>
                    <div className="flex gap-2">
                        <Button variant="ghost" className="rounded-2xl px-6 h-11 text-[13px]" onClick={onClose}>
                            Later
                        </Button>
                        <Button className="rounded-2xl px-8 h-11 text-[13px] bg-success hover:bg-success/90 text-white font-bold flex gap-2" onClick={handleDownload}>
                            <Download size={16} />
                            Download Now
                        </Button>
                    </div>
                </div>
            </div>
        </ModalBackdrop>
    );
};
