import React, { useRef, useState, useCallback, useMemo } from 'react';
import { useRowDetailStore } from '../../stores/rowDetailStore';
import { useLayoutStore } from '../../stores/layoutStore';
import { X, Copy, AlignLeft, FileJson, CheckSquare, Braces, RefreshCcw, Bookmark } from 'lucide-react';
import { useToast } from '../layout/Toast';
import { cn } from '../../lib/cn';
import { JsonViewer } from '../viewers/JsonViewer';
import { useEditorStore } from '../../stores/editorStore';
import { useConnectionStore } from '../../stores/connectionStore';
import { useBookmarkStore } from '../../stores/bookmarkStore';
import { DOM_EVENT } from '../../lib/constants';

// JSON type column name patterns
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

// Detect if a column is likely JSON based on name
const isJsonColumn = (colName: string, colType?: string): boolean => {
    if (colType) {
        const lowerType = colType.toLowerCase();
        if (lowerType.includes('json') || lowerType.includes('jsonb')) {
            return true;
        }
    }
    return JSON_COLUMN_PATTERNS.some(pattern => pattern.test(colName));
};

// Detect if a value is valid JSON
const isJsonValue = (val: string): boolean => {
    if (!val || typeof val !== 'string') return false;
    const trimmed = val.trim();
    if (trimmed.startsWith('data:image/')) return false;
    if (/^[A-Za-z0-9+/=]{20,}$/.test(trimmed)) return false;
    return (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
        (trimmed.startsWith('[') && trimmed.endsWith(']'));
};

export const RowDetailSidebar: React.FC = () => {
    const { detail, clearDetail } = useRowDetailStore();
    const { setShowRightSidebar } = useLayoutStore();
    const { toast } = useToast();
    const { groups, activeGroupId } = useEditorStore();
    const activeGroup = groups.find(g => g.id === activeGroupId);
    const activeTabId = activeGroup?.activeTabId || '';
    const { activeProfile } = useConnectionStore();
    const { byTab, loadBookmarks } = useBookmarkStore();
    const bookmarks = byTab[activeTabId] || [];

    // Resize state
    const [width, setWidth] = useState(300);
    const isResizing = useRef(false);

    // View modes
    const [viewMode, setViewMode] = useState<'form' | 'json'>('form');
    const [isSelectMode, setIsSelectMode] = useState(false);
    const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set());

    const startResizing = useCallback(() => { isResizing.current = true; }, []);
    const stopResizing = useCallback(() => { isResizing.current = false; }, []);

    const resize = useCallback((e: MouseEvent) => {
        if (isResizing.current) {
            const newWidth = window.innerWidth - e.clientX;
            if (newWidth > 200 && newWidth < 1000) {
                setWidth(newWidth);
            }
        }
    }, []);

    React.useEffect(() => {
        window.addEventListener('mousemove', resize);
        window.addEventListener('mouseup', stopResizing);
        return () => {
            window.removeEventListener('mousemove', resize);
            window.removeEventListener('mouseup', stopResizing);
        };
    }, [resize, stopResizing]);

    // Clear selections when switching rows
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

                // Try to parse JSON strings to make the output prettier
                if (typeof val === 'string' && (val.startsWith('{') || val.startsWith('['))) {
                    try {
                        val = JSON.parse(val);
                    } catch (e) {
                        // ignore
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
        navigator.clipboard.writeText(JSON.stringify(data, null, 2));

        const msg = (isSelectMode && selectedFields.size > 0)
            ? `Copied ${selectedFields.size} fields as JSON`
            : 'Copied full row as JSON';
        toast.success(msg);
    }, [detail, getJsonData, toast, isSelectMode, selectedFields.size]);


    const copyValue = (val: string) => {
        navigator.clipboard.writeText(val);
        toast.success('Copied to clipboard');
    };

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
            if (prev) {
                setSelectedFields(new Set()); // clear when exiting select mode
            }
            return !prev;
        });
    };

    const invertSelection = useCallback(() => {
        if (!detail) return;
        setSelectedFields(prev => {
            const next = new Set<string>();
            detail.columns.forEach(col => {
                if (!prev.has(col)) {
                    next.add(col);
                }
            });
            return next;
        });
    }, [detail]);

    const actionBtnClass = "bg-transparent border-none text-text-muted cursor-pointer px-1.25 py-1 rounded flex items-center justify-center transition-colors duration-150 hover:bg-bg-tertiary hover:text-text-primary";
    const actionBtnActiveClass = "bg-bg-tertiary text-[#7c6af7]";

    React.useEffect(() => {
        if (activeProfile?.name && activeTabId) {
            loadBookmarks(activeProfile.name, activeTabId).catch((err) => console.error('load bookmarks failed', err));
        }
    }, [activeProfile?.name, activeTabId, loadBookmarks]);

    const BookmarkPanel = (
        <div className="border-b border-border px-2 py-2 bg-bg-secondary">
            <div className="flex items-center gap-1.5 text-xs text-text-primary mb-2">
                <Bookmark size={12} />
                <span>Bookmarks ({bookmarks.length})</span>
            </div>
            <div className="max-h-[120px] overflow-auto">
                {bookmarks.length === 0 ? (
                    <div className="text-[11px] text-text-muted px-1 py-1">No bookmarks for this tab.</div>
                ) : (
                    bookmarks.map((item) => (
                        <button
                            key={item.id || item.line}
                            className="w-full text-left px-2 py-1 text-[11px] rounded hover:bg-bg-tertiary text-text-secondary hover:text-text-primary border-none bg-transparent cursor-pointer"
                            onClick={() => {
                                window.dispatchEvent(new CustomEvent(DOM_EVENT.JUMP_TO_LINE_ACTION, { detail: { tabId: activeTabId, line: item.line } }));
                            }}
                        >
                            Line {item.line}
                        </button>
                    ))
                )}
            </div>
        </div>
    );

    const EmptyState = (
        <>
            <div className="resizer right-resizer" onMouseDown={startResizing} style={{ cursor: 'e-resize' }} />
            <div className="sidebar flex flex-col h-full bg-bg-secondary border-l border-border shrink-0" style={{ width }}>
                <div className="flex items-center justify-between pr-2 border-b border-border bg-bg-secondary min-h-[35px]">
                    <button className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] text-text-primary border-b-2 border-success bg-transparent opacity-100" title="Row Detail">
                        <AlignLeft size={13} />
                        <span>Row Detail</span>
                    </button>
                    <button className={actionBtnClass} onClick={() => setShowRightSidebar(false)}>
                        <X size={14} />
                    </button>
                </div>
                {BookmarkPanel}
                <div className="flex-1 flex items-center justify-center text-text-muted text-xs h-full">
                    <p>No row selected</p>
                </div>
            </div>
        </>
    );

    if (!detail) return EmptyState;

    const { columns, columnTypes, row, tableName, primaryKeys, onSave } = detail;

    // Auto-detect which columns are JSON (simple function, not useMemo to avoid hook issues)
    const getJsonColumnIndices = () => {
        const indices = new Set<number>();
        columns.forEach((col, idx) => {
            const colType = columnTypes?.[idx];
            if (isJsonColumn(col, colType)) {
                indices.add(idx);
            } else {
                const val = row[idx];
                if (isJsonValue(val)) {
                    indices.add(idx);
                }
            }
        });
        return indices;
    };

    return (
        <>
            <div className="resizer right-resizer" onMouseDown={startResizing} style={{ cursor: 'e-resize' }} />
            <div className="sidebar flex flex-col h-full bg-bg-secondary border-l border-border shrink-0" style={{ width }}>
                <div className="flex items-center justify-between pr-2 border-b border-border bg-bg-secondary min-h-[35px]">
                    <button
                        className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] text-text-primary border-b-2 border-success bg-transparent opacity-100 flex-1 justify-start overflow-hidden"
                        title={`${tableName ? `Table: ${tableName} — ` : ''}`}
                    >
                        <AlignLeft size={13} className="shrink-0" />
                        <span className="overflow-hidden text-ellipsis whitespace-nowrap">
                            Row Detail {tableName && <span className="text-text-secondary font-normal normal-case ml-1">— {tableName}</span>}
                        </span>
                    </button>

                    <div className="flex items-center gap-1">
                        {viewMode === 'form' && isSelectMode && (
                            <button
                                className={actionBtnClass}
                                title="Invert selection"
                                onClick={invertSelection}
                            >
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
                            title={isSelectMode && selectedFields.size > 0 ? "Copy selected fields as JSON" : "Copy row as JSON"}
                            onClick={handleCopyJson}
                        >
                            <FileJson size={13} />
                        </button>
                        <button className={actionBtnClass} onClick={() => setShowRightSidebar(false)}>
                            <X size={14} />
                        </button>
                    </div>
                </div>
                {BookmarkPanel}

                <div className="flex-1 overflow-hidden p-1">
                    {viewMode === 'json' ? (
                        <div className="h-full overflow-hidden">
                            <JsonViewer value={JSON.stringify(getJsonData(), null, 2)} />
                        </div>
                    ) : (
                        columns.map((col, idx) => {
                            const val = row[idx];
                            const isNull = val === null || val === undefined;
                            const isPK = primaryKeys?.includes(col) ?? false;
                            const displayVal = isNull ? 'null' : (val === '' ? '' : String(val));
                            const jsonColumnIndices = getJsonColumnIndices();
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
                                    onSave={onSave}
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
        </>
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

    // Sync incoming value when row changes
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
            "flex flex-col gap-1 rounded p-0.5 transition-colors duration-150",
            isDirty && "bg-warning/10",
            isSelected && "bg-success/12"
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
                        className={cn("flex items-center gap-1 shrink-0", isPK && "text-[#7c6af7]")}
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
                    "bg-bg-primary border border-border rounded px-2 py-1.5 text-xs font-mono text-text-primary whitespace-pre-wrap break-all min-h-[28px] cursor-default opacity-85 select-text overflow-auto",
                    isNull && "text-text-muted italic bg-bg-tertiary",
                    isJsonField && "max-h-[200px]"
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
                        "bg-bg-primary border border-border rounded px-2 py-1.5 text-xs font-mono text-text-primary whitespace-pre-wrap break-all min-h-[28px] w-full box-border resize-y cursor-text outline-none leading-normal transition-all duration-150 focus:border-[#7c6af7] focus:shadow-[0_0_0_2px_rgba(124,106,247,0.2)] disabled:opacity-70 disabled:cursor-default disabled:resize-none",
                        isNull && "text-text-muted italic bg-bg-tertiary",
                        isDirty && "border-warning!"
                    )}
                    value={editVal}
                    onChange={(e) => handleChange(e.target.value)}
                    onBlur={commit}
                    onKeyDown={handleKeyDown}
                    rows={Math.max(1, Math.min(6, (editVal || '').split('\n').length))}
                    disabled={!onSave || isSelectMode}
                    title={
                        isSelectMode ? 'Click to select field' :
                            onSave ? 'Click to edit · Enter to save · Esc to cancel' :
                                'Read-only (no primary key)'
                    }
                    onClick={isSelectMode ? (e) => { e.preventDefault(); onToggleSelect(); } : undefined}
                />
            )}
        </div>
    );
};
