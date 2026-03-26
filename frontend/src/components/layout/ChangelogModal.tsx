import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ModalBackdrop, ModalFrame } from '../ui';
import changelogMd from '../../../../CHANGELOG.md?raw';

interface ChangelogModalProps {
    onClose: () => void;
}

export const ChangelogModal: React.FC<ChangelogModalProps> = ({ onClose }) => {
    return (
        <ModalBackdrop onClose={onClose} contentClassName="flex w-full items-center justify-center p-3">
            <ModalFrame
                title="Changelog"
                onClose={onClose}
                className="h-[80vh] w-[700px] max-h-[800px] max-w-[calc(100vw-24px)] rounded-xl border border-border shadow-elevation-lg"
                headerClassName="shrink-0 border-b border-border bg-bg-tertiary px-4 py-3"
                titleClassName="m-0 text-[14px] font-semibold text-text-primary"
                bodyClassName="min-h-0 flex-1 overflow-y-auto p-6 text-[13px] leading-relaxed markdown-body"
            >
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
            </ModalFrame>
        </ModalBackdrop>
    );
};
