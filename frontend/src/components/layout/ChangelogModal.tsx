import React, { useState, useEffect } from 'react';
import { X, FileText } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ModalBackdrop, Button } from '../ui';
import changelogMd from '../../../../CHANGELOG.md?raw';

interface ChangelogModalProps {
    onClose: () => void;
}

export const ChangelogModal: React.FC<ChangelogModalProps> = ({ onClose }) => {
    return (
        <ModalBackdrop onClose={onClose}>
            <div
                className="bg-bg-secondary border border-border rounded-xl w-[700px] h-[80vh] max-h-[800px] flex flex-col shadow-[0_10px_30px_rgba(0,0,0,0.5)] overflow-hidden text-text-primary animate-in zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-border bg-bg-tertiary shrink-0">
                    <div className="flex items-center gap-2">
                        <FileText size={16} className="text-accent" />
                        <span className="font-semibold text-text-primary text-[14px]">Changelog</span>
                    </div>
                    <Button variant="ghost" size="icon" className="w-6 h-6 rounded-md hover:bg-bg-primary" onClick={onClose}>
                        <X size={14} />
                    </Button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto w-full p-6 text-[13px] leading-relaxed markdown-body">
                    <ReactMarkdown 
                        remarkPlugins={[remarkGfm]}
                        components={{
                            h1: ({node, ...props}) => <h1 className="text-xl font-bold mt-2 mb-4 pb-2 border-b border-border" {...props} />,
                            h2: ({node, ...props}) => <h2 className="text-lg font-bold mt-6 mb-3 text-accent" {...props} />,
                            h3: ({node, ...props}) => <h3 className="text-[15px] font-bold mt-5 mb-2" {...props} />,
                            ul: ({node, ...props}) => <ul className="list-disc pl-5 mb-4 space-y-1 text-text-secondary" {...props} />,
                            li: ({node, ...props}) => <li className="pl-1" {...props} />,
                            a: ({node, ...props}) => <a className="text-accent hover:underline" target="_blank" rel="noreferrer" {...props} />,
                            p: ({node, ...props}) => <p className="mb-4 text-text-secondary" {...props} />,
                            strong: ({node, ...props}) => <strong className="font-semibold text-text-primary" {...props} />,
                        }}
                    >
                        {changelogMd}
                    </ReactMarkdown>
                </div>
            </div>
        </ModalBackdrop>
    );
};
