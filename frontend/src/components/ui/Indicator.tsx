import React from 'react';
import { cn } from '@/lib/cn';

type IndicatorMode = 'dot' | 'count';

interface IndicatorProps extends React.HTMLAttributes<HTMLSpanElement> {
    mode?: IndicatorMode;
    value?: number;
    showZero?: boolean;
    max?: number;
    color?: string;
}

export const Indicator: React.FC<IndicatorProps> = ({
    mode = 'dot',
    value,
    showZero = false,
    max = 99,
    color,
    className,
    style,
    ...props
}) => {
    if (mode === 'count') {
        const nextValue = typeof value === 'number' ? value : 0;
        if (!showZero && nextValue <= 0) return null;
        const displayValue = nextValue > max ? `${max}+` : nextValue.toString();

        return (
            <span
                className={cn(
                    'inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-label font-semibold leading-none',
                    className,
                )}
                style={{
                    backgroundColor: color,
                    ...style,
                }}
                {...props}
            >
                {displayValue}
            </span>
        );
    }

    return (
        <span
            className={cn('inline-block h-2 w-2 rounded-full', className)}
            style={{
                backgroundColor: color,
                ...style,
            }}
            {...props}
        />
    );
};

