import React, { useState } from 'react';
import { X, ExternalLink, Github, FileText } from 'lucide-react';
import { ModalBackdrop, Button } from '../ui';
import { ChangelogModal } from './ChangelogModal';
import zentroLogo from '../../assets/images/main-logo.png';
import pkg from '../../../package.json';

interface AboutModalProps {
    onClose: () => void;
}

export const AboutModal: React.FC<AboutModalProps> = ({ onClose }) => {
    const [showChangelog, setShowChangelog] = useState(false);

    if (showChangelog) {
        return <ChangelogModal onClose={() => setShowChangelog(false)} />;
    }

    return (
        <ModalBackdrop onClose={onClose}>
            <div
                className="bg-bg-secondary border border-border rounded-xl w-[400px] flex flex-col shadow-[0_10px_30px_rgba(0,0,0,0.5)] overflow-hidden text-text-primary animate-in zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-end p-3 pb-0">
                    <Button variant="ghost" size="icon" className="w-6 h-6 rounded-md hover:bg-bg-tertiary" onClick={onClose}>
                        <X size={14} />
                    </Button>
                </div>

                {/* Content */}
                <div className="flex flex-col items-center px-8 pb-8 pt-2">
                    {/* Logo Section */}
                    <div className="w-20 h-20 mb-4 bg-bg-tertiary rounded-2xl flex items-center justify-center p-3 shadow-sm border border-border/50">
                        <img src={zentroLogo} alt="Zentro Logo" className="w-full h-full object-contain drop-shadow-md" />
                    </div>

                    {/* App Info */}
                    <h2 className="text-xl font-bold tracking-tight mb-1 text-text-primary">Zentro</h2>
                    <p className="text-sm text-text-muted mb-4">Version {pkg.version}</p>

                    <p className="text-[13px] text-center text-text-secondary mb-6 leading-relaxed max-w-[280px]">
                        A blazingly fast, modern, and cross-platform desktop SQL client built for developers.
                    </p>

                    {/* Links / Dev Info */}
                    <div className="w-full flex flex-col gap-2">
                        <div className="flex items-center justify-between p-3 rounded-lg bg-bg-primary border border-border/50">
                            <span className="text-[13px] font-medium text-text-secondary">Author</span>
                            <span className="text-[13px] text-text-primary">AlexNguyen</span>
                        </div>
                        <a
                            href="https://github.com/alexnguyen03/zentro"
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center justify-between p-3 rounded-lg bg-bg-primary border border-border/50 hover:bg-bg-tertiary hover:border-border transition-colors group cursor-pointer"
                        >
                            <div className="flex items-center gap-2">
                                <Github size={15} className="text-text-muted group-hover:text-text-primary transition-colors" />
                                <span className="text-[13px] font-medium text-text-secondary group-hover:text-text-primary transition-colors">GitHub Repository</span>
                            </div>
                            <ExternalLink size={14} className="text-text-muted group-hover:text-accent transition-colors" />
                        </a>
                        <button
                            onClick={() => setShowChangelog(true)}
                            className="flex items-center justify-between p-3 rounded-lg bg-bg-primary border border-border/50 hover:bg-bg-tertiary hover:border-border transition-colors group cursor-pointer"
                        >
                            <div className="flex items-center gap-2">
                                <FileText size={15} className="text-text-muted group-hover:text-text-primary transition-colors" />
                                <span className="text-[13px] font-medium text-text-secondary group-hover:text-text-primary transition-colors">Release Notes (Changelog)</span>
                            </div>
                        </button>
                    </div>
                </div>
            </div>
        </ModalBackdrop>
    );
};
