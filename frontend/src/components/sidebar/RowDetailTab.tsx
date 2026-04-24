import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Copy, FileJson, CheckSquare, Braces, RefreshCcw } from 'lucide-react';
import { cn } from '../../lib/cn';
import { useRowDetailStore } from '../../stores/rowDetailStore';
import { useToast } from '../layout/Toast';
import { JsonViewer } from '../viewers/JsonViewer';
import { setClipboardText } from '../../services/clipboardService';
import { Button, Checkbox, Input, Label, Textarea } from '../ui';
import { useSidebarPanelState } from '../../stores/sidebarUiStore';
import { ROW_DETAIL_PANEL_STATE_DEFAULT } from './sidebarPanelStateDefaults';

const JSON_COLUMN_PATTERNS = [
    /json/i,
    /data/i,
    /config/i,
    /settings/i,
    /metadata/i,
    /payload/i,
    /attributes/i,
    /properties/i,
    /options/i,
    /extra/i,
    /content/i,
    /details/i,
];

const isJsonColumn = (colName: string, colType?: string): boolean => {
    if (colType) {
        const lowerType = colType.toLowerCase();
        if (lowerType.includes('json') || lowerType.includes('jsonb')) {
            return true;
        }
    }
    return JSON_COLUMN_PATTERNS.some((pattern) => pattern.test(colName));
};

const isJsonValue = (val: string): boolean => {
    if (!val || typeof val !== 'string') return false;
    const trimmed = val.trim();
    if (trimmed.startsWith('data:image/')) return false;
    if (/^[A-Za-z0-9+/=]{20,}$/.test(trimmed)) return false;
    return (trimmed.startsWith('{') && trimmed.endsWith('}'))
        || (trimmed.startsWith('[') && trimmed.endsWith(']'));
};

export const RowDetailTab: React.FC = () => {
    const { detail } = useRowDetailStore();
    const { toast } = useToast();

    const [rowDetailPanelState, setRowDetailPanelState] = useSidebarPanelState('secondary', 'detail', ROW_DETAIL_PANEL_STATE_DEFAULT);
    const viewMode = rowDetailPanelState.viewMode;
    const isSelectMode = rowDetailPanelState.isSelectMode;
    const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set());
    const [fieldFilter, setFieldFilter] = useState('');

    const updateRowDetailPanelState = useCallback((next: Partial<typeof rowDetailPanelState>) => {
        setRowDetailPanelState((current) => ({
            ...current,
            ...next,
        }));
    }, [setRowDetailPanelState]);

    React.useEffect(() => {
        setSelectedFields(new Set());
    }, [detail?.row]);

    const getJsonData = useCallback(() => {
        if (!detail) return {};
        const obj: Record<string, unknown> = {};
        const hasSelection = isSelectMode && selectedFields.size > 0;

        detail.columns.forEach((col, idx) => {
            if (!hasSelection || selectedFields.has(col)) {
                let val = detail.row[idx];
                if (typeof val === 'string' && (val.startsWith('{') || val.startsWith('['))) {
                    try {
                        val = JSON.parse(val);
                    } catch {
                        // ignore parse error
                    }
                }
                obj[col] = val ?? null;
            }
        });
        return obj;
    }, [detail, isSelectMode, selectedFields]);

    const handleCopyJson = useCallback(() => {
        if (!detail) return;
        const data = getJsonData();
        void setClipboardText(JSON.stringify(data, null, 2))
            .then(() => {
                const msg = (isSelectMode && selectedFields.size > 0)
                    ? `Copied ${selectedFields.size} fields as JSON`
                    : 'Copied full row as JSON';
                toast.success(msg);
            })
            .catch(() => toast.error('Failed to copy JSON'));
    }, [detail, getJsonData, toast, isSelectMode, selectedFields.size]);

    const toggleFieldSelection = (col: string) => {
        setSelectedFields((prev) => {
            const next = new Set(prev);
            if (next.has(col)) next.delete(col);
            else next.add(col);
            return next;
        });
    };

    const toggleSelectMode = () => {
        const nextValue = !isSelectMode;
        if (!nextValue) setSelectedFields(new Set());
        updateRowDetailPanelState({ isSelectMode: nextValue });
    };

    const invertSelection = useCallback(() => {
        if (!detail) return;
        setSelectedFields((prev) => {
            const next = new Set<string>();
            detail.columns.forEach((col) => {
                if (!prev.has(col)) next.add(col);
            });
            return next;
        });
    }, [detail]);

    const actionBtnClass = 'text-muted-foreground hover:text-foreground';
    const actionBtnActiveClass = 'bg-muted text-primary hover:text-primary';

    if (!detail) {
        return (
            <div className="flex h-full flex-1 items-center justify-center text-small text-muted-foreground">
                <p>No row selected</p>
            </div>
        );
    }

    const jsonColumnIndices = new Set<number>();
    detail.columns.forEach((col, idx) => {
        const colType = detail.columnTypes?.[idx];
        if (isJsonColumn(col, colType) || isJsonValue(detail.row[idx])) {
            jsonColumnIndices.add(idx);
        }
    });

    const copyValue = (val: string) => {
        void setClipboardText(val)
            .then(() => toast.success('Copied to clipboard'))
            .catch(() => toast.error('Failed to copy value'));
    };

    return (
        <div className="flex h-full flex-col overflow-hidden">
            <div className="mb-1 flex items-center justify-end gap-1 border-b border-border/50 pb-1">
                <div className="relative flex-1 min-w-0">
                    <Input
                        size="sm"
                        variant="ghost"
                        value={fieldFilter}
                        onChange={(e) => setFieldFilter(e.target.value)}
                        placeholder="Filter fields..."
                        className="pr-6"
                        onKeyDown={(e) => { if (e.key === 'Escape') setFieldFilter(''); }}
                    />
                    {fieldFilter && (
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => setFieldFilter('')}
                            className="absolute right-0.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                                <line x1="2" y1="2" x2="8" y2="8" /><line x1="8" y1="2" x2="2" y2="8" />
                            </svg>
                        </Button>
                    )}
                </div>
                {viewMode === 'form' && isSelectMode && (
                    <Button type="button" variant="ghost" size="icon" className={actionBtnClass} title="Invert selection" onClick={invertSelection}>
                        <RefreshCcw size={13} />
                    </Button>
                )}
                {viewMode === 'form' && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className={cn(actionBtnClass, isSelectMode && actionBtnActiveClass)}
                        title="Toggle selection mode for custom JSON copy"
                        onClick={toggleSelectMode}
                    >
                        <CheckSquare size={13} />
                    </Button>
                )}
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={cn(actionBtnClass, viewMode === 'json' && actionBtnActiveClass)}
                    title="Toggle JSON view"
                    onClick={() => updateRowDetailPanelState({ viewMode: viewMode === 'form' ? 'json' : 'form' })}
                >
                    <Braces size={13} />
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={actionBtnClass}
                    title={isSelectMode && selectedFields.size > 0 ? 'Copy selected fields as JSON' : 'Copy row as JSON'}
                    onClick={handleCopyJson}
                >
                    <FileJson size={13} />
                </Button>
            </div>

            <div className="flex-1 overflow-auto">
                {viewMode === 'json' ? (
                    <JsonViewer value={JSON.stringify(getJsonData(), null, 2)} showCopy={false} />
                ) : (
                    detail.columns.map((col, idx) => {
                        if (fieldFilter && !col.toLowerCase().includes(fieldFilter.toLowerCase())) return null;
                        const val = detail.row[idx];
                        const isNull = val === null || val === undefined;
                        const isPK = detail.primaryKeys?.includes(col) ?? false;
                        const displayVal = isNull ? 'null' : (val === '' ? '' : String(val));
                        const isJsonField = jsonColumnIndices.has(idx);

                        return (
                            <RowDetailField
                                key={`${col}-${idx}`}
                                col={col}
                                val={displayVal}
                                isNull={isNull}
                                isPK={isPK}
                                colIdx={idx}
                                onCopy={() => !isNull && copyValue(val)}
                                onSave={detail.onSave}
                                isSelectMode={isSelectMode}
                                isSelected={selectedFields.has(col)}
                                onToggleSelect={() => toggleFieldSelection(col)}
                                isJsonField={isJsonField}
                            />
                        );
                    })
                )}
            </div>
        </div>
    );
};

interface RowDetailFieldProps {
    col: string;
    val: string;
    isNull: boolean;
    isPK: boolean;
    colIdx: number;
    onCopy: () => void;
    onSave?: (colIdx: number, newVal: string) => void;
    isSelectMode: boolean;
    isSelected: boolean;
    onToggleSelect: () => void;
    isJsonField?: boolean;
}

const RowDetailField: React.FC<RowDetailFieldProps> = ({
    col, val, isNull, isPK, colIdx, onCopy, onSave,
    isSelectMode, isSelected, onToggleSelect, isJsonField,
}) => {
    const [editVal, setEditVal] = useState(val);
    const [isDirty, setIsDirty] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const checkboxId = `row-cb-${colIdx}`;

    useEffect(() => {
        setEditVal(val);
        setIsDirty(false);
        setIsEditing(false);
    }, [val, col]);

    useEffect(() => {
        if (!isEditing) return;
        const el = textareaRef.current;
        if (!el) return;
        el.focus();
        el.select();
    }, [isEditing]);

    const commit = useCallback(() => {
        if (!isDirty || !onSave || isPK) {
            setIsEditing(false);
            return;
        }
        onSave(colIdx, editVal);
        setIsDirty(false);
        setIsEditing(false);
    }, [colIdx, editVal, isDirty, isPK, onSave]);

    const handleChange = (newVal: string) => {
        setEditVal(newVal);
        setIsDirty(true);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            commit();
        } else if (e.key === 'Escape') {
            setEditVal(val);
            setIsDirty(false);
            setIsEditing(false);
        }
    };

    const openEditor = () => {
        if (!onSave || isPK || isJsonField || isSelectMode) return;
        setIsEditing(true);
    };

    return (
        <div
            className={cn(
                'flex flex-col gap-0.5 p-0.5 transition-colors duration-150',
                isDirty && 'bg-warning/10',
                isSelected && ' bg-[--state-selected-bg]',
            )}
        >
            <div className="group flex items-center justify-between gap-1 text-label font-semibold text-muted-foreground">
                <div className="flex items-center gap-1.5 overflow-hidden">
                    {isSelectMode && (
                        <Checkbox
                            id={checkboxId}
                            checked={isSelected}
                            onCheckedChange={() => onToggleSelect()}
                            className="h-3.5 w-3.5 shrink-0"
                        />
                    )}
                    <Label
                        htmlFor={isSelectMode ? checkboxId : undefined}
                        className={cn(
                            'm-0 flex items-center gap-1 text-label text-muted-foreground',
                            isSelectMode ? 'cursor-pointer' : 'cursor-default',
                            isPK && 'text-primary',
                        )}
                    >
                        {isPK && (
                            <span className="rounded-sm border border-primary/35 bg-primary/15 px-1 py-[1px] text-label  tracking-[0.04em] text-primary">
                                PK
                            </span>
                        )}
                        {col}
                    </Label>
                </div>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    className="shrink-0 text-muted-foreground opacity-0 transition-opacity duration-200 hover:text-foreground group-hover:opacity-100 disabled:cursor-default disabled:opacity-0"
                    onClick={onCopy}
                    title="Copy value"
                    disabled={isNull}
                >
                    <Copy size={11} />
                </Button>
            </div>
            {isJsonField ? (
                <div
                    className={cn(
                        'min-h-[28px] overflow-auto rounded-sm border border-border bg-background px-2 py-1.5 font-mono text-label text-foreground opacity-85',
                        'whitespace-pre-wrap break-all select-text',
                        isNull && 'bg-muted italic text-muted-foreground',
                        isJsonField && 'max-h-[200px]',
                        isSelectMode && 'cursor-pointer',
                    )}
                >
                    {isNull ? 'null' : isJsonField ? (
                        <JsonViewer value={val} showCopy={false} height="180px" useMonaco={true} />
                    ) : val}
                </div>
            ) : !isEditing ? (
                <div className="h-7 rounded-sm border border-border">
                    <div
                        className={cn(
                            'rt-cell-content rt-cell-content--compact h-full rounded-sm bg-background font-mono text-label text-foreground',
                            'whitespace-pre-wrap break-all',
                            isNull && 'bg-muted italic text-muted-foreground',
                            isDirty && 'rt-cell-dirty',
                            (!onSave || isPK) && 'cursor-default opacity-70',
                            onSave && !isPK && !isSelectMode && 'cursor-text',
                            isSelectMode && 'cursor-pointer',
                        )}
                        title={
                            isSelectMode ? 'Click to select field'
                                : isPK ? 'Primary key (read-only)'
                                    : onSave ? 'Click to edit | Enter to save | Esc to cancel'
                                    : 'Read-only (no primary key)'
                        }
                        onClick={isSelectMode ? onToggleSelect : openEditor}
                    >
                        {isNull ? 'null' : val}
                    </div>
                </div>
            ) : (
                <Textarea
                    ref={textareaRef}
                    className={cn(
                        'rt-cell-input rt-cell-content--compact h-7! min-h-7! pt-2! ring-0! w-full resize-y whitespace-pre-wrap break-all font-mono shadow-none leading-[1.3] focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:outline-none!',
                        isNull && 'bg-muted italic text-muted-foreground',
                        isDirty && 'border-warning',
                        !onSave && 'cursor-default resize-none opacity-70',
                        isSelectMode && 'cursor-pointer resize-none',
                    )}
                    value={editVal}
                    onChange={(e) => handleChange(e.target.value)}
                    onBlur={commit}
                    onKeyDown={handleKeyDown}
                    rows={Math.max(1, Math.min(6, (editVal || '').split('\n').length))}
                    disabled={!onSave || isSelectMode}
                    title="Enter to save | Esc to cancel"
                />
            )}
        </div>
    );
};
