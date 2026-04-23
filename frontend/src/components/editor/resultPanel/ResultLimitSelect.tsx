import React from 'react';
import { cn } from '../../../lib/cn';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui';
import { LIMIT_OPTIONS } from '../resultPanelUtils';

interface ResultLimitSelectProps {
    value: number;
    onChange: (value: string) => void;
    variant?: 'toolbar' | 'statusbar';
    className?: string;
    title?: string;
}

const TRIGGER_CLASS: Record<NonNullable<ResultLimitSelectProps['variant']>, string> = {
    toolbar: 'h-7 min-w-10 border-border/40 bg-transparent px-1 text-label! text-muted-foreground hover:bg-muted/70',
    statusbar: 'h-6 min-w-10 border-border/40 bg-transparent px-1 text-label! text-text-secondary hover:bg-bg-tertiary',
};

export const ResultLimitSelect: React.FC<ResultLimitSelectProps> = ({
    value,
    onChange,
    variant = 'toolbar',
    className,
    title = 'Row limit for next query',
}) => {
    const currentLabel = value.toLocaleString();
    const triggerWidthCh = Math.max(8, currentLabel.length + 4);

    return (
        <Select value={String(value)} onValueChange={onChange}>
            <SelectTrigger
                className={cn(TRIGGER_CLASS[variant], className)}
                title={title}
                style={{ width: `${triggerWidthCh}ch` }}
            >
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                {LIMIT_OPTIONS.map((option) => (
                    <SelectItem key={option} value={String(option)}>
                        {option.toLocaleString()}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
};
