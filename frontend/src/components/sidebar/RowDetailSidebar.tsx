import React, { useRef, useState } from 'react';
import { useRowDetailStore } from '../../stores/rowDetailStore';
import { useLayoutStore } from '../../stores/layoutStore';
import { X, Copy, AlignLeft } from 'lucide-react';
import { useToast } from '../layout/Toast';
import './RowDetailSidebar.css';

export const RowDetailSidebar: React.FC = () => {
    const { detail, clearDetail } = useRowDetailStore();
    const { setShowRightSidebar } = useLayoutStore();
    const { toast } = useToast();

    // Resize state
    const [width, setWidth] = useState(300);
    const isResizing = useRef(false);

    const startResizing = React.useCallback(() => { isResizing.current = true; }, []);
    const stopResizing = React.useCallback(() => { isResizing.current = false; }, []);

    const resize = React.useCallback((e: MouseEvent) => {
        if (isResizing.current) {
            // e.clientX is from left, window.innerWidth is total
            // width = window.innerWidth - e.clientX
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

    if (!detail) {
        return (
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
    }

    const { columns, row, tableName } = detail;

    const copyValue = (val: string) => {
        navigator.clipboard.writeText(val);
        toast.success('Copied to clipboard');
    };

    return (
        <>
            <div className="resizer right-resizer" onMouseDown={startResizing} style={{ cursor: 'e-resize' }} />
            <div className="sidebar row-detail-sidebar" style={{ width }}>
                <div className="sidebar-tab-bar" style={{ justifyContent: 'space-between', paddingRight: '8px' }}>
                    <button className="sidebar-tab-btn active" title={tableName ? `Table: ${tableName}` : 'Row Detail'} style={{ flex: 1, justifyContent: 'flex-start', overflow: 'hidden' }}>
                        <AlignLeft size={13} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            Row Detail {tableName && <span className="row-detail-table-name" style={{ marginLeft: 4 }}>— {tableName}</span>}
                        </span>
                    </button>
                    <button className="row-detail-close" onClick={() => setShowRightSidebar(false)}>
                        <X size={14} />
                    </button>
                </div>
                <div className="sidebar-content row-detail-content">
                    {columns.map((col, idx) => {
                        const val = row[idx];
                        const isNull = val === null || val === undefined;
                        const displayVal = isNull ? 'null' : (val === '' ? ' ' : val);

                        return (
                            <div key={`${col}-${idx}`} className="row-detail-field">
                                <div className="row-detail-key">
                                    <span>{col}</span>
                                    <button
                                        className="row-detail-copy-btn"
                                        onClick={() => !isNull && copyValue(val)}
                                        title="Copy value"
                                        disabled={isNull}
                                    >
                                        <Copy size={11} />
                                    </button>
                                </div>
                                <div className={`row-detail-value ${isNull ? 'row-detail-null' : ''}`}>
                                    {displayVal}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </>
    );
};
