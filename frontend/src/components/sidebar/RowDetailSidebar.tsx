import React, { useRef, useState, useCallback } from 'react';
import { useRowDetailStore } from '../../stores/rowDetailStore';
import { useLayoutStore } from '../../stores/layoutStore';
import { X, Copy, AlignLeft, FileJson } from 'lucide-react';
import { useToast } from '../layout/Toast';
import './RowDetailSidebar.css';

export const RowDetailSidebar: React.FC = () => {
    const { detail, clearDetail } = useRowDetailStore();
    const { setShowRightSidebar } = useLayoutStore();
    const { toast } = useToast();

    // Resize state
    const [width, setWidth] = useState(300);
    const isResizing = useRef(false);

    const startResizing = useCallback(() => { isResizing.current = true; }, []);
    const stopResizing = useCallback(() => { isResizing.current = false; }, []);

    const resize = useCallback((e: MouseEvent) => {
        if (isResizing.current) {
            const newWidth = window.innerWidth - e.clientX;
            if (newWidth > 200 && newWidth < 800) {
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

    // Double-click on tab header → copy as JSON
    const lastTabClickTime = useRef(0);
    const handleTabHeaderClick = useCallback(() => {
        if (!detail) return;
        const now = Date.now();
        if (now - lastTabClickTime.current < 400) {
            // Double-click → copy as JSON
            const obj: Record<string, string | null> = {};
            detail.columns.forEach((col, idx) => {
                obj[col] = detail.row[idx] ?? null;
            });
            navigator.clipboard.writeText(JSON.stringify(obj, null, 2));
            toast.success('Row copied as JSON');
            lastTabClickTime.current = 0;
        } else {
            lastTabClickTime.current = now;
        }
    }, [detail, toast]);

    const copyValue = (val: string) => {
        navigator.clipboard.writeText(val);
        toast.success('Copied to clipboard');
    };

    const copyAsJson = () => {
        if (!detail) return;
        const obj: Record<string, string | null> = {};
        detail.columns.forEach((col, idx) => {
            obj[col] = detail.row[idx] ?? null;
        });
        navigator.clipboard.writeText(JSON.stringify(obj, null, 2));
        toast.success('Row copied as JSON');
    };

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
                    <button
                        className="row-detail-action-btn"
                        title="Copy row as JSON"
                        onClick={copyAsJson}
                    >
                        <FileJson size={13} />
                    </button>
                    <button className="row-detail-close" onClick={() => setShowRightSidebar(false)}>
                        <X size={14} />
                    </button>
                </div>
                <div className="sidebar-content row-detail-content">
                    {columns.map((col, idx) => {
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
                            />
                        );
                    })}
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
}

const RowDetailField: React.FC<RowDetailFieldProps> = ({ col, val, isNull, isPK, colIdx, onCopy, onSave }) => {
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
        <div className={`row-detail-field ${isDirty ? 'row-detail-field-dirty' : ''}`}>
            <div className="row-detail-key">
                <span className={isPK ? 'row-detail-pk-label' : ''}>
                    {isPK && <span className="row-detail-pk-badge">PK</span>}
                    {col}
                </span>
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
                <div className={`row-detail-value row-detail-pk-value ${isNull ? 'row-detail-null' : ''}`}>
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
                    disabled={!onSave}
                    title={onSave ? 'Click to edit · Enter to save · Esc to cancel' : 'Read-only (no primary key)'}
                />
            )}
        </div>
    );
};
