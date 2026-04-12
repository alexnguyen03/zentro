import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Check } from 'lucide-react';
import { Button, Popover, PopoverContent, PopoverTrigger } from '../../ui';

export interface ColumnPickerCellProps {
    columns: string[];
    selected: string[];
    onChange: (cols: string[]) => void;
    onClose: () => void;
    autoOpen?: boolean;
}

export const ColumnPickerCell: React.FC<ColumnPickerCellProps> = ({
    columns, selected, onChange, onClose, autoOpen = false,
}) => {
    const [open, setOpen] = useState(autoOpen);
    const selectedRef = React.useRef(selected);
    selectedRef.current = selected;

    const toggle = (col: string) => {
        const current = selectedRef.current;
        onChange(current.includes(col) ? current.filter((c) => c !== col) : [...current, col]);
    };

    const handleOpenChange = (next: boolean) => {
        setOpen(next);
        if (!next) setTimeout(onClose, 0);
    };

    const label = selected.length === 0 ? 'Select columns…' : selected.join(', ');

    return (
        <Popover open={open} onOpenChange={handleOpenChange}>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="ghost"
                    onMouseDown={(e) => e.stopPropagation()}
                    className={`
                        flex h-[26px] w-full items-center justify-between rounded border border-border/40
                        bg-background px-2 text-[12px] text-left font-mono transition-colors
                        hover:border-border focus:outline-none focus:ring-1 focus:ring-primary
                        ${open ? 'border-primary ring-1 ring-primary' : ''}
                    `}
                >
                    <span className={`truncate ${selected.length === 0 ? 'text-muted-foreground/50' : 'text-foreground'}`}>
                        {label}
                    </span>
                    {open
                        ? <ChevronUp size={11} className="shrink-0 text-muted-foreground ml-1" />
                        : <ChevronDown size={11} className="shrink-0 text-muted-foreground ml-1" />}
                </Button>
            </PopoverTrigger>
            <PopoverContent
                align="start"
                side="bottom"
                sideOffset={4}
                className="z-panel-overlay w-[var(--radix-popover-trigger-width)] min-w-[200px] rounded-sm border border-border bg-popover p-1 shadow-elevation-md"
            >
                <div className="max-h-[220px] overflow-y-auto">
                    {columns.length === 0 && (
                        <div className="px-3 py-2 text-[11px] text-muted-foreground">No columns available</div>
                    )}
                    {columns.map((col) => {
                        const checked = selected.includes(col);
                        return (
                            <Button
                                key={col}
                                type="button"
                                variant="ghost"
                                onMouseDown={(e) => e.stopPropagation()}
                                onClick={() => toggle(col)}
                                className={`
                                    flex w-full items-center gap-2.5 rounded px-2 py-1.5 text-[12px] text-left h-auto justify-start
                                    transition-colors hover:bg-accent/10 font-mono
                                    ${checked ? 'text-foreground font-medium' : 'text-muted-foreground'}
                                `}
                            >
                                <div className={`
                                    flex h-3.5 w-3.5 items-center justify-center rounded-sm border transition-colors shrink-0
                                    ${checked ? 'bg-primary border-primary text-primary-foreground' : 'border-border/60 bg-background'}
                                `}>
                                    {checked && <Check size={10} strokeWidth={3} />}
                                </div>
                                <span className="truncate">{col}</span>
                            </Button>
                        );
                    })}
                </div>
            </PopoverContent>
        </Popover>
    );
};
