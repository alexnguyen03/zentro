import React, { useState } from 'react';
import { ExternalLink, Github, FileText } from 'lucide-react';
import { Modal } from './Modal';
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
        <Modal
            isOpen
            onClose={onClose}
            title="About Zentro"
            width={420}
            className="rounded-md border border-border/10 shadow-elevation-lg"
        >
            <div className="overflow-y-auto px-5 pb-5 pt-1">
                <div className="flex flex-col items-center">
                    {/* Integrated Logo Section */}
                    <div className="w-24 h-24 mb-6 bg-bg-tertiary/40 rounded-md flex items-center justify-center p-4 border border-border/5">
                        <img src={zentroLogo} alt="Zentro Logo" className="w-full h-full object-contain" />
                    </div>

                    {/* App Branding */}
                    <h2 className="text-2xl font-bold tracking-tight mb-1 text-text-primary">Zentro</h2>
                    <div className="px-3 py-1 rounded-full bg-accent/5 border border-accent/10 mb-6">
                        <span className="text-[11px] font-bold text-accent uppercase tracking-widest">Version {pkg.version}</span>
                    </div>

                    <p className="text-[14px] text-center text-text-muted mb-8 leading-relaxed font-medium">
                        A blazingly fast, modern, and cross-platform desktop SQL client built for developers.
                    </p>

                    {/* Information Grid */}
                    <div className="w-full flex flex-col gap-2.5">
                        <div className="flex items-center justify-between px-5 py-4 rounded-md bg-bg-tertiary/20 border border-border/5">
                            <span className="text-[13px] font-bold text-text-secondary">Author</span>
                            <span className="text-[13px] font-medium text-text-primary">AlexNguyen</span>
                        </div>

                        <a
                            href="https://github.com/alexnguyen03/zentro"
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center justify-between px-5 py-4 rounded-md bg-bg-tertiary/20 border border-border/5 hover:bg-bg-tertiary/40 hover:border-accent/10 transition-all group cursor-pointer"
                        >
                            <div className="flex items-center gap-3">
                                <Github size={16} className="text-text-muted group-hover:text-accent transition-colors" />
                                <span className="text-[13px] font-bold text-text-secondary group-hover:text-text-primary transition-colors">GitHub Repository</span>
                            </div>
                            <ExternalLink size={14} className="text-text-muted/40 group-hover:text-accent transition-colors" />
                        </a>

                        <button
                            onClick={() => setShowChangelog(true)}
                            className="flex items-center justify-between px-5 py-4 rounded-md bg-bg-tertiary/20 border border-border/5 hover:bg-bg-tertiary/40 hover:border-accent/10 transition-all group cursor-pointer"
                        >
                            <div className="flex items-center gap-3">
                                <FileText size={16} className="text-text-muted group-hover:text-accent transition-colors" />
                                <span className="text-[13px] font-bold text-text-secondary group-hover:text-text-primary transition-colors">Release Notes</span>
                            </div>
                            <ExternalLink size={14} className="text-text-muted/40 group-hover:text-accent transition-colors" />
                        </button>
                    </div>
                </div>
            </div>
        </Modal>
    );
};
