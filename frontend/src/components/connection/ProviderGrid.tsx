import React from 'react';
import { cn } from '../../lib/cn';
import { PROVIDERS, ProviderConfig } from '../../lib/providers';
import { Button } from '../ui';

interface ProviderGridProps {
    selected: string;
    /** When true, only the active provider is clickable (edit mode) */
    locked?: boolean;
    filterText?: string;
    className?: string;
    onSelect: (key: string) => void;
}

interface ProviderButtonProps {
    provider: ProviderConfig;
    active: boolean;
    disabled: boolean;
    onSelect: (key: string) => void;
}

const ProviderButton: React.FC<ProviderButtonProps> = ({ provider, active, disabled, onSelect }) => (
    <Button
        type="button"
        variant="ghost"
        title={provider.label}
        disabled={disabled}
        onClick={() => !disabled && onSelect(provider.key)}
        className={cn(
            'relative aspect-square h-auto w-full rounded-md border p-2 transition-all duration-200 select-none',
            active
                ? 'border-success/60 shadow-[0_2px_8px_rgba(0,0,0,0.05)]'
                : disabled
                    ? 'border-transparent cursor-not-allowed opacity-40 grayscale'
                    : 'border-transparent hover:border-border/80'
        )}
        style={{ background: `${provider.color}${active ? '15' : '08'}` }}
    >
        <img
            src={provider.icon}
            alt={provider.label}
            className="h-9 w-9 max-h-full max-w-full object-contain drop-shadow-sm transition-transform duration-200 hover:scale-110"
        />
        {active && (
            <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full border-2 border-bg-secondary bg-success shadow-[0_0_4px_rgba(34,197,94,0.6)]" />
        )}
    </Button>
);

export const ProviderGrid: React.FC<ProviderGridProps> = ({
    selected,
    locked = false,
    filterText = '',
    className,
    onSelect,
}) => {
    const query = filterText.trim().toLowerCase();
    const visibleProviders = query
        ? PROVIDERS.filter((provider) =>
            provider.label.toLowerCase().includes(query) || provider.key.toLowerCase().includes(query))
        : PROVIDERS;

    return (
        <div className={cn('grid h-full min-h-0 content-start gap-3 overflow-y-auto bg-background px-3 py-3 [grid-template-columns:repeat(auto-fill,minmax(96px,1fr))]', className)}>
            {visibleProviders.map((provider) => (
                <ProviderButton
                    key={provider.key}
                    provider={provider}
                    active={provider.key === selected}
                    disabled={locked && provider.key !== selected}
                    onSelect={onSelect}
                />
            ))}
            {visibleProviders.length === 0 && (
                <div className="col-span-full rounded-md border border-dashed border-border/35 px-3 py-5 text-center text-[12px] text-muted-foreground">
                    No providers found.
                </div>
            )}
        </div>
    );
};
