import React from 'react';
import { cn } from '../../lib/cn';
import { PROVIDERS, ProviderConfig } from '../../lib/providers';

interface ProviderGridProps {
    selected: string;
    /** When true, only the active provider is clickable (edit mode) */
    locked?: boolean;
    onSelect: (key: string) => void;
}

interface ProviderButtonProps {
    provider: ProviderConfig;
    active: boolean;
    disabled: boolean;
    onSelect: (key: string) => void;
}

const ProviderButton: React.FC<ProviderButtonProps> = ({ provider, active, disabled, onSelect }) => (
    <button
        type="button"
        title={provider.label}
        disabled={disabled}
        onClick={() => !disabled && onSelect(provider.key)}
        className={cn(
            'relative flex h-11 items-center justify-center rounded-lg border p-1.5 transition-all duration-200 select-none',
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
            className="h-6 w-6 max-h-full max-w-full object-contain drop-shadow-sm transition-transform duration-200 hover:scale-110"
        />
        {active && (
            <span className="absolute -top-1 -right-1 w-3 h-3 border-2 border-bg-secondary rounded-full bg-success shadow-[0_0_4px_rgba(34,197,94,0.6)]" />
        )}
    </button>
);

export const ProviderGrid: React.FC<ProviderGridProps> = ({ selected, locked = false, onSelect }) => (
    <div className="h-full min-h-0 overflow-y-auto bg-bg-primary px-2 py-2 grid grid-cols-4 gap-2 content-start">
        {PROVIDERS.map(p => (
            <ProviderButton
                key={p.key}
                provider={p}
                active={p.key === selected}
                disabled={locked && p.key !== selected}
                onSelect={onSelect}
            />
        ))}
    </div>
);
