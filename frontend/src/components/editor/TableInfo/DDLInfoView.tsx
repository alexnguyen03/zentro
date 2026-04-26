import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Copy, FileCode2, Loader } from 'lucide-react';
import { GetTableDDL } from '../../../services/schemaService';
import { useConnectionStore } from '../../../stores/connectionStore';
import { useToast } from '../../layout/Toast';
import { highlightSQL } from '../../../lib/sqlHighlight';
import { getErrorMessage } from '../../../lib/errors';
import { setClipboardText } from '../../../services/clipboardService';
import { type TabAction } from './types';

interface DDLInfoViewProps {
    schema: string;
    tableName: string;
    refreshKey: number;
    onActionsChange?: (actions: TabAction[]) => void;
}

export const DDLInfoView: React.FC<DDLInfoViewProps> = ({ schema, tableName, refreshKey, onActionsChange }) => {
    const [ddl, setDdl] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const actionsSignatureRef = useRef('');
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
        } catch (err: unknown) {
            toast.error(`Failed to load DDL: ${getErrorMessage(err)}`);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadDdl();
    }, [schema, tableName, activeProfile?.name, refreshKey]);

    const handleCopy = async () => {
        try {
            await setClipboardText(ddl);
            toast.success('DDL copied to clipboard');
        } catch (err: unknown) {
            toast.error(`Failed to copy DDL: ${getErrorMessage(err)}`);
        }
    };

    const panelActions = useMemo<TabAction[]>(() => ([
        {
            id: 'ddl-copy',
            icon: <Copy size={12} />,
            label: 'Copy',
            title: 'Copy DDL',
            onClick: () => { void handleCopy(); },
            disabled: !ddl,
        },
    ]), [ddl]);

    useEffect(() => {
        if (!onActionsChange) return;
        const signature = panelActions
            .map((action) => `${action.id}:${action.disabled ? 1 : 0}:${action.loading ? 1 : 0}:${action.danger ? 1 : 0}`)
            .join('|');
        if (actionsSignatureRef.current === signature) return;
        actionsSignatureRef.current = signature;
        onActionsChange(panelActions);
    }, [onActionsChange, panelActions]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-10 h-full gap-2 text-muted-foreground">
                <Loader size={20} className="animate-spin text-accent" />
                <span className="text-small animate-pulse mt-2">Generating DDL...</span>
            </div>
        );
    }

    if (!ddl) {
        return (
            <div className="flex flex-col items-center justify-center p-12 h-full text-center">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-6">
                    <FileCode2 size={32} className="text-muted-foreground" />
                </div>
                <h2 className="text-h2  text-foreground mb-2">No DDL Available</h2>
                <p className="text-small text-muted-foreground max-w-sm">
                    Unable to generate CREATE script for this table.
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-background overflow-hidden">
            <div className="flex items-center px-4 py-2 bg-card border-b border-border/50 shrink-0">
                <div className="flex items-center gap-2 text-small font-medium text-foreground">
                    <FileCode2 size={14} className="text-accent" />
                    <span>CREATE Script - {schema}.{tableName}</span>
                </div>
            </div>

            <div className="flex-1 overflow-auto p-4 bg-background">
                <pre
                    className="text-small font-mono leading-loose text-foreground select-text"
                    // eslint-disable-next-line react/no-danger
                    dangerouslySetInnerHTML={{ __html: highlighted }}
                />
            </div>
        </div>
    );
};

