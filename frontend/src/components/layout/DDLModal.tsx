import React, { useState, useMemo } from 'react';
import { Copy, Check, FileCode2 } from 'lucide-react';
import { Modal } from '../layout/Modal';
import { Button } from '../ui';
import { GetTableDDL } from '../../../wailsjs/go/app/App';
import { useConnectionStore } from '../../stores/connectionStore';
import { useToast } from '../layout/Toast';
import { highlightSQL } from '../../lib/sqlHighlight';

interface DDLModalProps {
    isOpen: boolean;
    onClose: () => void;
    schema: string;
    tableName: string;
}

export const DDLModal: React.FC<DDLModalProps> = ({ isOpen, onClose, schema, tableName }) => {
    const [ddl, setDdl] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);
    const { activeProfile } = useConnectionStore();
    const { toast } = useToast();

    const highlighted = useMemo(() => highlightSQL(ddl), [ddl]);

    React.useEffect(() => {
        if (isOpen && activeProfile?.name) {
            setLoading(true);
            setDdl('');
            GetTableDDL(activeProfile.name, schema, tableName)
                .then(setDdl)
                .catch((err) => toast.error(`Failed to get DDL: ${err}`))
                .finally(() => setLoading(false));
        }
    }, [isOpen, schema, tableName, activeProfile]);

    const handleCopy = async () => {
        await navigator.clipboard.writeText(ddl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={
                <div className="flex items-center gap-2">
                    <FileCode2 size={18} className="text-accent" />
                    <span>DDL — {schema}.{tableName}</span>
                </div>
            }
            width={740}
            className="z-modal"
            footer={
                <>
                    <Button variant="ghost" onClick={onClose}>
                        Close
                    </Button>
                    <Button variant="primary" onClick={handleCopy} disabled={!ddl}>
                        {copied ? <Check size={14} className="mr-1.5" /> : <Copy size={14} className="mr-1.5" />}
                        {copied ? 'Copied!' : 'Copy'}
                    </Button>
                </>
            }
        >
            <div className="bg-bg-primary rounded-md border border-border overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center p-10 text-text-secondary text-[13px] gap-2">
                        <span className="animate-spin inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
                        Loading DDL…
                    </div>
                ) : (
                    <pre
                        className="p-4 text-[12px] font-mono overflow-auto max-h-[460px] leading-relaxed"
                        // eslint-disable-next-line react/no-danger
                        dangerouslySetInnerHTML={{ __html: highlighted }}
                    />
                )}
            </div>
        </Modal>
    );
};
