import React, { useEffect, useLayoutEffect, useState, useRef } from 'react';
import ReactDOM from 'react-dom';

interface DataTypeCellProps {
    value: string;
    types: string[];
    isDirty: boolean;
    disabled: boolean;
    onCommit: (v: string) => void;
}

export const DataTypeCell: React.FC<DataTypeCellProps> = ({ value, types, isDirty, disabled, onCommit }) => {
    const [editing, setEditing] = useState(false);
    const [text, setText] = useState(value);
    const [dropPos, setDropPos] = useState<{ top: number; left: number; width: number } | null>(null);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const wrapRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    const filtered = text
        ? types.filter(t => t.toLowerCase().includes(text.toLowerCase()))
        : types;

    useEffect(() => {
        setSelectedIndex(-1);
    }, [text]);

    useEffect(() => {
        if (selectedIndex >= 0 && listRef.current) {
            const el = listRef.current.children[selectedIndex] as HTMLDivElement;
            if (el) el.scrollIntoView({ block: 'nearest' });
        }
    }, [selectedIndex]);

    useEffect(() => {
        if (!editing) return;
        const handler = (e: MouseEvent) => {
            const target = e.target as Node;
            const insideWrap = wrapRef.current?.contains(target);
            const insideDrop = (target as Element).closest?.('[data-dtype-drop]');
            if (!insideWrap && !insideDrop) commitAndClose(text);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [editing, text]);

    useLayoutEffect(() => {
        if (!editing || !inputRef.current) return;
        const r = inputRef.current.getBoundingClientRect();
        setDropPos({ top: r.bottom + 2, left: r.left, width: Math.max(r.width, 220) });
    }, [editing]);

    const openEditor = () => {
        if (disabled) return;
        setText(value);
        setEditing(true);
    };

    const commitAndClose = (v: string) => {
        const trimmed = v.trim();
        if (trimmed && trimmed !== value) onCommit(trimmed);
        setEditing(false);
        setDropPos(null);
    };

    const closeWithoutCommit = () => {
        setEditing(false);
        setDropPos(null);
    };

    const handleSuggestionClick = (t: string) => {
        setText(t);
        requestAnimationFrame(() => {
            if (inputRef.current) {
                inputRef.current.focus();
                inputRef.current.select();
                const r = inputRef.current.getBoundingClientRect();
                setDropPos({ top: r.bottom + 2, left: r.left, width: Math.max(r.width, 220) });
            }
        });
    };

    const dropdown = dropPos && filtered.length > 0
        ? ReactDOM.createPortal(
            <div
                ref={listRef}
                data-dtype-drop
                className="fixed z-50 overflow-y-auto bg-bg-secondary border border-border/40 rounded-2xl"
                style={{
                    top: dropPos.top,
                    left: dropPos.left,
                    width: dropPos.width,
                    maxHeight: 220,
                    boxShadow: 'none',
                }}
            >
                {filtered.map((t, index) => {
                    const isSelected = index === selectedIndex || (selectedIndex === -1 && t === text);
                    return (
                        <div
                            key={t}
                            onMouseDown={e => { e.preventDefault(); handleSuggestionClick(t); }}
                            className={`px-4 py-2 text-xs font-mono cursor-pointer transition-colors ${isSelected
                                    ? 'bg-accent text-bg-primary font-bold'
                                    : 'text-text-primary/80 hover:bg-bg-tertiary hover:text-text-primary'
                                }`}
                        >
                            {t}
                        </div>
                    );
                })}
            </div>,
            document.body
        )
        : null;

    if (!editing) {
        return (
            <div
                className={`rt-cell-content font-mono text-[11px]! ${isDirty ? 'rt-cell-dirty' : ''} ${disabled ? 'opacity-40' : ''}`}
                onDoubleClick={openEditor}
                title={`${value} (Double-click to edit)`}
            >
                {value}
            </div>
        );
    }

    return (
        <div ref={wrapRef} className="relative w-full h-full">
            <input
                ref={inputRef}
                autoFocus
                onFocus={(e) => e.target.select()}
                className="rt-cell-input font-mono text-[11px]! border-accent!"
                value={text}
                onChange={e => { setText(e.target.value); }}
                onKeyDown={e => {
                    if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        if (filtered.length > 0) {
                            setSelectedIndex(prev => (prev < filtered.length - 1 ? prev + 1 : prev));
                        }
                    } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        if (filtered.length > 0) {
                            setSelectedIndex(prev => (prev > 0 ? prev - 1 : 0));
                        }
                    } else if (e.key === 'Enter') {
                        e.preventDefault();
                        if (selectedIndex >= 0 && selectedIndex < filtered.length) {
                            handleSuggestionClick(filtered[selectedIndex]);
                        } else {
                            commitAndClose(text);
                        }
                    } else if (e.key === 'Escape') {
                        e.preventDefault();
                        closeWithoutCommit();
                    } else if (e.key === 'Tab') {
                        commitAndClose(text);
                    }
                }}
                onBlur={() => { setTimeout(() => commitAndClose(text), 150); }}
            />
            {dropdown}
        </div>
    );
};

