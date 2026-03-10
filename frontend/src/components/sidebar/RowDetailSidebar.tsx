import React, { useRef, useState, useCallback, useMemo } from 'react';
import { useRowDetailStore } from '../../stores/rowDetailStore';
import { useLayoutStore } from '../../stores/layoutStore';
import { X, Copy, AlignLeft, FileJson, CheckSquare, Braces, RefreshCcw } from 'lucide-react';
import { useToast } from '../layout/Toast';
import './RowDetailSidebar.css';

export const RowDetailSidebar: React.FC = () => {
    const { detail, clearDetail } = useRowDetailStore();
    const { setShowRightSidebar } = useLayoutStore();
    const { toast } = useToast();

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

    // Double-click on tab header → copy as JSON
    const lastTabClickTime = useRef(0);
    const handleTabHeaderClick = useCallback(() => {
        if (!detail) return;
        const now = Date.now();
        if (now - lastTabClickTime.current < 400) {
            handleCopyJson();
            lastTabClickTime.current = 0;
        } else {
            lastTabClickTime.current = now;
        }
    }, [detail, handleCopyJson]);

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

    const EmptyState = (
        <>
            <div className="resizer right-resizer" onMouseDown={startResizing} style={{ cursor: 'e-resize' }} />
            <div className="sidebar row-detail-sidebar" style={{ width }}>
                <div className="sidebar-tab-bar" style={{ justifyContent: 'space-between', paddingRight: '8px' }}>
                    <button className="sidebar-tab-btn active" title="Row Detail">
                        <AlignLeft size={13} />
                        <span>Row Detail</span>
                    </button>
                    <button className="row-detail-close" onClick={() => setShowRightSidebar(false)}>
                        <X size={14} />
                    </button>
                </div>
                <div className="sidebar-content">
                    <div className="row-detail-empty">
                        <p>No row selected</p>
                    </div>
                </div>
            </div>
        </>
    );

    if (!detail) return EmptyState;

    const { columns, row, tableName, primaryKeys, onSave } = detail;

    return (
        <>
            <div className="resizer right-resizer" onMouseDown={startResizing} style={{ cursor: 'e-resize' }} />
            <div className="sidebar row-detail-sidebar" style={{ width }}>
                <div
                    className="sidebar-tab-bar row-detail-tab-bar"
                    style={{ justifyContent: 'space-between', paddingRight: '8px' }}
                >
                    <button
                        className="sidebar-tab-btn active"
                        title={`${tableName ? `Table: ${tableName} — ` : ''}Double-click to copy as JSON`}
                        style={{ flex: 1, justifyContent: 'flex-start', overflow: 'hidden' }}
                        onClick={handleTabHeaderClick}
                    >
                        <AlignLeft size={13} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            Row Detail {tableName && <span className="row-detail-table-name" style={{ marginLeft: 4 }}>— {tableName}</span>}
                        </span>
                    </button>

                    <div className="row-detail-actions">
                        {viewMode === 'form' && isSelectMode && (
                            <button
                                className="row-detail-action-btn"
                                title="Invert selection"
                                onClick={invertSelection}
                            >
                                <RefreshCcw size={13} />
                            </button>
                        )}
                        {viewMode === 'form' && (
                            <button
                                className={`row-detail-action-btn ${isSelectMode ? 'active' : ''}`}
                                title="Toggle selection mode for custom JSON copy"
                                onClick={toggleSelectMode}
                            >
                                <CheckSquare size={13} />
                            </button>
                        )}
                        <button
                            className={`row-detail-action-btn ${viewMode === 'json' ? 'active' : ''}`}
                            title="Toggle JSON view"
                            onClick={() => setViewMode(v => v === 'form' ? 'json' : 'form')}
                        >
                            <Braces size={13} />
                        </button>
                        <button
                            className="row-detail-action-btn"
                            title={isSelectMode && selectedFields.size > 0 ? "Copy selected fields as JSON" : "Copy row as JSON"}
                            onClick={handleCopyJson}
                        >
                            <FileJson size={13} />
                        </button>
                        <button className="row-detail-close" onClick={() => setShowRightSidebar(false)}>
                            <X size={14} />
                        </button>
                    </div>
                </div>

                <div className="sidebar-content row-detail-content">
                    {viewMode === 'json' ? (
                        <div className="row-detail-json-view">
                            <pre>{JSON.stringify(getJsonData(), null, 2)}</pre>
                        </div>
                    ) : (
                        columns.map((col, idx) => {
                            const val = row[idx];
                            const isNull = val === null || val === undefined;
                            const isPK = primaryKeys?.includes(col) ?? false;
                            const displayVal = isNull ? 'null' : (val === '' ? '' : val);

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
}

const RowDetailField: React.FC<RowDetailFieldProps> = ({
    col, val, isNull, isPK, colIdx, onCopy, onSave,
    isSelectMode, isSelected, onToggleSelect
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
    }, [isDirty, onSave, isPK, colIdx, editVal]);

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
        <div className={`row-detail-field ${isDirty ? 'row-detail-field-dirty' : ''} ${isSelected ? 'row-detail-field-selected' : ''}`}>
            <div className="row-detail-key">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                    {isSelectMode && (
                        <input
                            type="checkbox"
                            id={`row-cb-${colIdx}`}
                            checked={isSelected}
                            onChange={onToggleSelect}
                            className="row-detail-checkbox"
                        />
                    )}
                    <label
                        htmlFor={isSelectMode ? `row-cb-${colIdx}` : undefined}
                        className={isPK ? 'row-detail-pk-label' : ''}
                        style={{ cursor: isSelectMode ? 'pointer' : 'default', display: 'flex', alignItems: 'center', margin: 0, gap: '4px' }}
                    >
                        {isPK && <span className="row-detail-pk-badge">PK</span>}
                        {col}
                    </label>
                </div>
                <button
                    className="row-detail-copy-btn"
                    onClick={onCopy}
                    title="Copy value"
                    disabled={isNull}
                >
                    <Copy size={11} />
                </button>
            </div>
            {isPK ? (
                <div className={`row-detail-value row-detail-pk-value ${isNull ? 'row-detail-null' : ''}`}
                    onClick={isSelectMode ? onToggleSelect : undefined}
                    style={{ cursor: isSelectMode ? 'pointer' : 'default' }}>
                    {isNull ? 'null' : val}
                </div>
            ) : (
                <textarea
                    className={`row-detail-value row-detail-textarea ${isNull ? 'row-detail-null' : ''} ${isDirty ? 'row-detail-dirty' : ''}`}
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
