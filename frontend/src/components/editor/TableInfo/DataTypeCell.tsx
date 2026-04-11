import React, { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '../../../lib/cn';
import {
    Command,
    CommandItem,
    CommandList,
    Input,
    Popover,
    PopoverAnchor,
    PopoverContent,
} from '../../ui';

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
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const wrapRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const filtered = useMemo(() => (
        text ? types.filter((t) => t.toLowerCase().includes(text.toLowerCase())) : types
    ), [text, types]);

    useEffect(() => {
        if (!editing) return;
        setSelectedIndex(-1);
    }, [text, editing]);

    useEffect(() => {
        if (!editing || !inputRef.current) return;
        requestAnimationFrame(() => {
            if (!inputRef.current) return;
            inputRef.current.focus();
            inputRef.current.select();
        });
    }, [editing]);

    useEffect(() => {
        if (!editing) return;
        const handleOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            const insideWrap = wrapRef.current?.contains(target);
            const insidePopover = (target as Element).closest?.('[data-dtype-popover]');
            if (!insideWrap && !insidePopover) {
                closeEditor('commit');
            }
        };
        document.addEventListener('mousedown', handleOutside);
        return () => document.removeEventListener('mousedown', handleOutside);
    }, [editing, text, value]);

    const openEditor = () => {
        if (disabled) return;
        setText(value);
        setSelectedIndex(-1);
        setEditing(true);
    };

    const closeEditor = (intent: 'commit' | 'discard') => {
        if (intent === 'commit') {
            const trimmed = text.trim();
            if (trimmed && trimmed !== value) onCommit(trimmed);
        } else {
            setText(value);
        }
        setEditing(false);
    };

    const handleSuggestionPick = (suggestion: string) => {
        setText(suggestion);
        setSelectedIndex(-1);
        if (inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    };

    if (!editing) {
        return (
            <div
                className={cn(
                    'rt-cell-content rt-cell-content--compact font-mono',
                    isDirty && 'rt-cell-dirty',
                    disabled && 'opacity-40',
                )}
                onDoubleClick={openEditor}
                title={`${value} (Double-click to edit)`}
            >
                {value}
            </div>
        );
    }

    return (
        <Popover open={editing}>
            <PopoverAnchor asChild>
                <div ref={wrapRef} className="relative h-full w-full">
                    <Input
                        ref={inputRef}
                        autoFocus
                        onFocus={(e) => e.target.select()}
                        className="rt-cell-input font-mono text-label"
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        onBlur={() => {
                            // keep focus stable while selecting via suggestion mousedown
                            window.setTimeout(() => {
                                if (!editing) return;
                                const active = document.activeElement as Element | null;
                                const insidePopover = active?.closest?.('[data-dtype-popover]');
                                const insideWrap = active ? wrapRef.current?.contains(active) : false;
                                if (!insideWrap && !insidePopover) closeEditor('commit');
                            }, 0);
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'ArrowDown') {
                                e.preventDefault();
                                e.stopPropagation();
                                if (filtered.length > 0) {
                                    setSelectedIndex((prev) => (
                                        prev < filtered.length - 1 ? prev + 1 : prev
                                    ));
                                }
                            } else if (e.key === 'ArrowUp') {
                                e.preventDefault();
                                e.stopPropagation();
                                if (filtered.length > 0) {
                                    setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
                                }
                            } else if (e.key === 'Enter') {
                                e.preventDefault();
                                e.stopPropagation();
                                if (selectedIndex >= 0 && selectedIndex < filtered.length) {
                                    handleSuggestionPick(filtered[selectedIndex]);
                                } else {
                                    closeEditor('commit');
                                }
                            } else if (e.key === 'Escape') {
                                e.preventDefault();
                                e.stopPropagation();
                                closeEditor('discard');
                            } else if (e.key === 'Tab') {
                                e.stopPropagation();
                                closeEditor('commit');
                            }
                        }}
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            </PopoverAnchor>
            <PopoverContent
                align="start"
                side="bottom"
                sideOffset={4}
                data-dtype-popover
                className="z-panel-overlay w-[var(--radix-popover-trigger-width)] min-w-[220px] rounded-md border border-border bg-popover p-1 shadow-elevation-md"
            >
                <Command className="border-0 bg-transparent">
                    <CommandList className="max-h-[220px]">
                        {filtered.length === 0 && (
                            <div className="px-3 py-2 text-xs text-muted-foreground">
                                No matching data type
                            </div>
                        )}
                        {filtered.map((typeName, index) => {
                            const isSelected = index === selectedIndex || (selectedIndex === -1 && typeName === text);
                            return (
                                <CommandItem
                                    key={typeName}
                                    value={typeName}
                                    onMouseDown={(event) => {
                                        event.preventDefault();
                                        handleSuggestionPick(typeName);
                                    }}
                                    onSelect={() => handleSuggestionPick(typeName)}
                                    className={cn(
                                        'font-mono text-xs',
                                        isSelected && 'bg-accent text-foreground font-semibold',
                                    )}
                                >
                                    {typeName}
                                </CommandItem>
                            );
                        })}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
};
