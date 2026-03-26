import React, { useState, useCallback } from 'react';
import { Copy, FileJson, CheckSquare, Braces, RefreshCcw } from 'lucide-react';
import { cn } from '../../lib/cn';
import { useRowDetailStore } from '../../stores/rowDetailStore';
import { useToast } from '../layout/Toast';
import { JsonViewer } from '../viewers/JsonViewer';
import { setClipboardText } from '../../services/clipboardService';

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
    return JSON_COLUMN_PATTERNS.some(pattern => pattern.test(colName));
};

const isJsonValue = (val: string): boolean => {
    if (!val || typeof val !== 'string') return false;
    const trimmed = val.trim();
    if (trimmed.startsWith('data:image/')) return false;
    if (/^[A-Za-z0-9+/=]{20,}$/.test(trimmed)) return false;
    return (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
        (trimmed.startsWith('[') && trimmed.endsWith(']'));
};

export const RowDetailTab: React.FC = () => {
    const { detail } = useRowDetailStore();
    const { toast } = useToast();

    const [viewMode, setViewMode] = useState<'form' | 'json'>('form');
    const [isSelectMode, setIsSelectMode] = useState(false);
    const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set());

    React.useEffect(() => {
        setSelectedFields(new Set());
    }, [detail?.row]);

    const getJsonData = useCallback(() => {
        if (!detail) return {};
        const obj: Record<string, any> = {};
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
        setSelectedFields(prev => {
            const next = new Set(prev);
            if (next.has(col)) next.delete(col);
            else next.add(col);
            return next;
        });
    };

    const toggleSelectMode = () => {
        setIsSelectMode(prev => {
            if (prev) setSelectedFields(new Set());
            return !prev;
        });
    };

    const invertSelection = useCallback(() => {
        if (!detail) return;
        setSelectedFields(prev => {
            const next = new Set<string>();
            detail.columns.forEach(col => {
                if (!prev.has(col)) next.add(col);
            });
            return next;
        });
    }, [detail]);

    const actionBtnClass = 'bg-transparent border-none text-text-muted cursor-pointer px-1.25 py-1 rounded flex items-center justify-center transition-colors duration-150 hover:bg-bg-tertiary hover:text-text-primary';
    const actionBtnActiveClass = 'bg-bg-tertiary text-[#7c6af7]';

    if (!detail) {
        return (
            <div className="flex-1 flex items-center justify-center text-text-muted text-xs h-full">
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
        <div className="h-full flex flex-col overflow-hidden">
            <div className="flex items-center justify-end gap-1 pb-1 border-b border-border/50 mb-1">
                {viewMode === 'form' && isSelectMode && (
                    <button className={actionBtnClass} title="Invert selection" onClick={invertSelection}>
                        <RefreshCcw size={13} />
                    </button>
                )}
                {viewMode === 'form' && (
                    <button
                        className={cn(actionBtnClass, isSelectMode && actionBtnActiveClass)}
                        title="Toggle selection mode for custom JSON copy"
                        onClick={toggleSelectMode}
                    >
                        <CheckSquare size={13} />
                    </button>
                )}
                <button
                    className={cn(actionBtnClass, viewMode === 'json' && actionBtnActiveClass)}
                    title="Toggle JSON view"
                    onClick={() => setViewMode(v => v === 'form' ? 'json' : 'form')}
                >
                    <Braces size={13} />
                </button>
                <button
                    className={actionBtnClass}
                    title={isSelectMode && selectedFields.size > 0 ? 'Copy selected fields as JSON' : 'Copy row as JSON'}
                    onClick={handleCopyJson}
                >
                    <FileJson size={13} />
                </button>
            </div>

            <div className="flex-1 overflow-auto">
                {viewMode === 'json' ? (
                    <JsonViewer value={JSON.stringify(getJsonData(), null, 2)} />
                ) : (
                    detail.columns.map((col, idx) => {
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
    isSelectMode, isSelected, onToggleSelect, isJsonField
}) => {
    const [editVal, setEditVal] = useState(val);
    const [isDirty, setIsDirty] = useState(false);

    React.useEffect(() => {
        setEditVal(val);
        setIsDirty(false);
    }, [val, col]);

    const commit = useCallback(() => {
        if (!isDirty || !onSave || isPK) return;
        onSave(colIdx, editVal);
        setIsDirty(false);
    }, [colIdx, editVal, isDirty, isPK, onSave]);

    const handleChange = (newVal: string) => {
        setEditVal(newVal);
        setIsDirty(true);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            commit();
        } else if (e.key === 'Escape') {
            setEditVal(val);
            setIsDirty(false);
        }
    };

    return (
        <div className={cn(
            'flex flex-col gap-1 rounded p-0.5 transition-colors duration-150',
            isDirty && 'bg-warning/10',
            isSelected && 'bg-success/12'
        )}>
            <div className="group text-[11px] text-text-secondary font-semibold flex items-center justify-between gap-1">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                    {isSelectMode && (
                        <input
                            type="checkbox"
                            id={`row-cb-${colIdx}`}
                            checked={isSelected}
                            onChange={onToggleSelect}
                            className="m-0 cursor-pointer accent-success shrink-0"
                        />
                    )}
                    <label
                        htmlFor={isSelectMode ? `row-cb-${colIdx}` : undefined}
                        className={cn('flex items-center gap-1 shrink-0', isPK && 'text-[#7c6af7]')}
                        style={{ cursor: isSelectMode ? 'pointer' : 'default', margin: 0 }}
                    >
                        {isPK && <span className="text-[9px] font-bold tracking-[0.04em] bg-[#7c6af7]/20 text-[#7c6af7] border border-[#7c6af7]/40 rounded-[3px] px-1 py-[1px]">PK</span>}
                        {col}
                    </label>
                </div>
                <button
                    className="bg-transparent border-none text-text-muted cursor-pointer p-0.5 rounded-[3px] opacity-0 transition-opacity duration-200 shrink-0 group-hover:opacity-100 hover:bg-bg-tertiary hover:text-text-primary disabled:opacity-0 disabled:cursor-default"
                    onClick={onCopy}
                    title="Copy value"
                    disabled={isNull || isJsonField}
                >
                    <Copy size={11} />
                </button>
            </div>
            {isPK || isJsonField ? (
                <div className={cn(
                    'bg-bg-primary border border-border rounded px-2 py-1.5 text-xs font-mono text-text-primary whitespace-pre-wrap break-all min-h-[28px] cursor-default opacity-85 select-text overflow-auto',
                    isNull && 'text-text-muted italic bg-bg-tertiary',
                    isJsonField && 'max-h-[200px]'
                )}
                    style={{
                        cursor: isSelectMode ? 'pointer' : 'default',
                    }}>
                    {isNull ? 'null' : isJsonField ? (
                        <JsonViewer value={val} showCopy={true} height="180px" useMonaco={true} />
                    ) : val}
                </div>
            ) : (
                <textarea
                    className={cn(
                        'bg-bg-primary border border-border rounded px-2 py-1.5 text-xs font-mono text-text-primary whitespace-pre-wrap break-all min-h-[28px] w-full box-border resize-y cursor-text outline-none leading-normal transition-all duration-150 focus:border-[#7c6af7] focus:shadow-[0_0_0_2px_rgba(124,106,247,0.2)] disabled:opacity-70 disabled:cursor-default disabled:resize-none',
                        isNull && 'text-text-muted italic bg-bg-tertiary',
                        isDirty && 'border-warning!'
                    )}
                    value={editVal}
                    onChange={(e) => handleChange(e.target.value)}
                    onBlur={commit}
                    onKeyDown={handleKeyDown}
                    rows={Math.max(1, Math.min(6, (editVal || '').split('\n').length))}
                    disabled={!onSave || isSelectMode}
                    title={
                        isSelectMode ? 'Click to select field' :
                            onSave ? 'Click to edit | Enter to save | Esc to cancel' :
                                'Read-only (no primary key)'
                    }
                    onClick={isSelectMode ? (e) => { e.preventDefault(); onToggleSelect(); } : undefined}
                />
            )}
        </div>
    );
};

