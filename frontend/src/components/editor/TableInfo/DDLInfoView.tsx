import React, { useEffect, useState, useMemo } from 'react';
import { Loader, Copy, Check, FileCode2 } from 'lucide-react';
import { GetTableDDL } from '../../../../wailsjs/go/app/App';
import { useConnectionStore } from '../../../stores/connectionStore';
import { useToast } from '../../layout/Toast';
import { highlightSQL } from '../../../lib/sqlHighlight';
import { Button } from '../../ui';

interface DDLInfoViewProps {
    schema: string;
    tableName: string;
    refreshKey: number; // Trigger reload
}

export const DDLInfoView: React.FC<DDLInfoViewProps> = ({ schema, tableName, refreshKey }) => {
    const [ddl, setDdl] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [copied, setCopied] = useState(false);
    const { activeProfile } = useConnectionStore();
    const { toast } = useToast();

    const highlighted = useMemo(() => highlightSQL(ddl), [ddl]);

    const loadDdl = async () => {
        if (!activeProfile?.name) return;
        setLoading(true);
        setDdl('');
        try {
            const data = await GetTableDDL(activeProfile.name, schema, tableName);
            setDdl(data || '');
        } catch (err: any) {
            toast.error(`Failed to load DDL: ${err}`);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadDdl();
    }, [schema, tableName, activeProfile?.name, refreshKey]);

    const handleCopy = async () => {
        await navigator.clipboard.writeText(ddl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-10 h-full gap-2 text-text-secondary">
                <Loader size={20} className="animate-spin text-accent" />
                <span className="text-[12px] animate-pulse mt-2">Generating DDL...</span>
            </div>
        );
    }

    if (!ddl) {
        return (
            <div className="flex flex-col items-center justify-center p-12 h-full text-center">
                <div className="w-16 h-16 rounded-full bg-bg-tertiary flex items-center justify-center mb-6">
                    <FileCode2 size={32} className="text-text-muted" />
                </div>
                <h2 className="text-lg font-bold text-text-primary mb-2">No DDL Available</h2>
                <p className="text-[13px] text-text-secondary max-w-sm">
                    Unable to generate CREATE script for this table.
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-bg-primary overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 bg-bg-secondary border-b border-border/50 shrink-0">
                <div className="flex items-center gap-2 text-[12px] font-medium text-text-primary">
                    <FileCode2 size={14} className="text-accent" />
                    <span>CREATE Script — {schema}.{tableName}</span>
                </div>
                <Button variant="ghost" size="sm" onClick={handleCopy} className="h-7 px-2" disabled={!ddl}>
                    {copied ? <Check size={13} className="mr-1.5 text-success" /> : <Copy size={13} className="mr-1.5" />}
                    {copied ? 'Copied' : 'Copy'}
                </Button>
            </div>
            
            <div className="flex-1 overflow-auto p-4 bg-bg-primary">
                <pre
                    className="text-[12px] font-mono leading-loose text-text-primary select-text"
                    // eslint-disable-next-line react/no-danger
                    dangerouslySetInnerHTML={{ __html: highlighted }}
                />
            </div>
        </div>
    );
};
