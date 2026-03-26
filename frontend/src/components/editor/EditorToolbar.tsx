import React, { useState, useEffect, useRef } from 'react';
import {
    BookDashed,
    AlignJustify,
    Plus,
    Play,
    Search,
    Columns2,
    Square,
    GitBranchPlus,
    Check,
    Undo2,
} from 'lucide-react';
import { Button, Divider } from '../ui';
import { useTemplateStore } from '../../stores/templateStore';
import { useConnectionStore } from '../../stores/connectionStore';
import { useEditorStore } from '../../stores/editorStore';
import { useStatusStore } from '../../stores/statusStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { cn } from '../../lib/cn';
import { TemplatePopover } from './TemplatePopover';
import { models } from '../../../wailsjs/go/models';
import { DOM_EVENT } from '../../lib/constants';
import { emitCommand } from '../../lib/commandBus';
import { BeginTransaction, CommitTransaction, RollbackTransaction, CancelQuery } from '../../services/queryService';
import { getErrorMessage } from '../../lib/errors';
import { useToast } from '../layout/Toast';

type Template = models.Template;

interface EditorToolbarProps {
    isActive?: boolean;
    tabId?: string;
    readOnly?: boolean;
}

export const EditorToolbar: React.FC<EditorToolbarProps> = ({ isActive, tabId, readOnly }) => {
    const { loadTemplates } = useTemplateStore();
    const { isConnected } = useConnectionStore();
    const addTab = useEditorStore((state) => state.addTab);
    const groups = useEditorStore((state) => state.groups);
    const { transactionStatus } = useStatusStore();
    const viewMode = useSettingsStore((state) => state.viewMode);
    const { toast } = useToast();
    const [showPopover, setShowPopover] = useState(false);
    const plusBtnRef = useRef<HTMLButtonElement>(null);
    const txActive = transactionStatus === 'active';

    const currentTab = groups
        .flatMap((group) => group.tabs)
        .find((tab) => tab.id === tabId);
    const isRunning = currentTab?.isRunning ?? false;
    const canRunEditorAction = Boolean(isActive && isConnected && !readOnly);

    useEffect(() => {
        loadTemplates();
    }, []);

    const handleRun = () => {
        if (!tabId || !canRunEditorAction) return;
        emitCommand(DOM_EVENT.RUN_QUERY_ACTION, { tabId });
    };

    const handleExplain = (analyze: boolean) => {
        if (!tabId || !canRunEditorAction) return;
        emitCommand(DOM_EVENT.RUN_EXPLAIN_ACTION, { tabId, analyze });
    };

    const handleCancel = async () => {
        if (!tabId) return;
        try {
            await CancelQuery(tabId);
        } catch {
            // ignore
        }
    };

    const handleBeginTransaction = async () => {
        try {
            await BeginTransaction();
            toast.success('Transaction started.');
        } catch (error: unknown) {
            toast.error(`Begin transaction failed: ${getErrorMessage(error)}`);
        }
    };

    const handleCommitTransaction = async () => {
        try {
            await CommitTransaction();
            toast.success('Transaction committed.');
        } catch (error: unknown) {
            toast.error(`Commit failed: ${getErrorMessage(error)}`);
        }
    };

    const handleRollbackTransaction = async () => {
        try {
            await RollbackTransaction();
            toast.success('Transaction rolled back.');
        } catch (error: unknown) {
            toast.error(`Rollback failed: ${getErrorMessage(error)}`);
        }
    };

    return (
        <div className="h-10 flex items-center justify-between shrink-0 select-none px-3">
            <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" title="New Tab (Ctrl+T)" onClick={() => addTab()} disabled={!isActive}>
                    <Plus size={16} />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    disabled={!canRunEditorAction || isRunning}
                    title="Run Query (Ctrl+Enter)"
                    onClick={handleRun}
                >
                    <Play size={16} color={!canRunEditorAction || isRunning ? 'currentColor' : 'var(--status-success)'} />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    disabled={!canRunEditorAction || isRunning}
                    title="Explain"
                    onClick={() => handleExplain(false)}
                >
                    <Search size={14} />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    disabled={!canRunEditorAction || isRunning}
                    title="Explain Analyze"
                    onClick={() => handleExplain(true)}
                >
                    <Search size={14} className="text-accent" />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    title="Compare Queries"
                    onClick={() => emitCommand(DOM_EVENT.OPEN_QUERY_COMPARE)}
                    disabled={!isActive}
                >
                    <Columns2 size={14} />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    disabled={!isRunning || !isActive}
                    title="Cancel Execution"
                    onClick={handleCancel}
                >
                    <Square
                        size={16}
                        fill={isRunning && isActive ? 'currentColor' : 'none'}
                        color={isRunning && isActive ? 'var(--status-error)' : 'currentColor'}
                    />
                </Button>

                <Divider orientation="vertical" className="h-5" />

                <Button
                    variant="ghost"
                    size="icon"
                    disabled={!isConnected || txActive || !isActive || viewMode}
                    title="Begin Transaction"
                    onClick={handleBeginTransaction}
                >
                    <GitBranchPlus size={14} color={!isConnected || txActive || !isActive || viewMode ? 'currentColor' : 'var(--status-success)'} />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    disabled={!isConnected || !txActive || !isActive || viewMode}
                    title="Commit Transaction"
                    onClick={handleCommitTransaction}
                >
                    <Check size={14} color={!isConnected || !txActive || !isActive || viewMode ? 'currentColor' : 'var(--interactive-primary)'} />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    disabled={!isConnected || !txActive || !isActive || viewMode}
                    title="Rollback Transaction"
                    onClick={handleRollbackTransaction}
                >
                    <Undo2 size={14} color={!isConnected || !txActive || !isActive || viewMode ? 'currentColor' : 'var(--status-error)'} />
                </Button>
            </div>

            <div className="flex items-center gap-1 pl-4">
                <Button
                    variant="ghost"
                    size="icon"
                    className="hover:text-success"
                    title="Format Query (Ctrl+Shift+F)"
                    onClick={() => {
                        if (!isActive) return;
                        emitCommand(DOM_EVENT.FORMAT_QUERY_ACTION);
                    }}
                >
                    <AlignJustify size={14} />
                </Button>
                <Button
                    ref={plusBtnRef}
                    variant="ghost"
                    size="icon"
                    className={cn(
                        "hover:text-success",
                        showPopover && "bg-success/20 text-success"
                    )}
                    onClick={() => setShowPopover(!showPopover)}
                    title="Manage Templates"
                >
                    <BookDashed size={14} />
                </Button>
            </div>

            {showPopover && (
                <TemplatePopover
                    onClose={() => setShowPopover(false)}
                    anchorRect={plusBtnRef.current?.getBoundingClientRect() || null}
                />
            )}
        </div>
    );
};

