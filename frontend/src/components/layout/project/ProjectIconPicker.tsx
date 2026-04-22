import React from 'react';
import { Button, Popover, PopoverContent, PopoverTrigger } from '../../ui';
import { PROJECT_ICON_MAP, PROJECT_ICON_OPTIONS, type ProjectIconKey } from '../projectHubMeta';
import { cn } from '../../../lib/cn';

interface ProjectIconPickerProps {
    value: ProjectIconKey;
    onChange: (key: ProjectIconKey) => void;
}

export const ProjectIconPicker: React.FC<ProjectIconPickerProps> = ({ value, onChange }) => {
    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon-md"
                    className="flex h-16 w-16 shrink-0 items-center justify-center rounded-sm bg-muted text-foreground outline-none transition hover:opacity-70 focus-visible:ring-2 focus-visible:ring-ring"
                    title="Change project icon"
                >
                    {React.createElement(PROJECT_ICON_MAP[value].icon, { size: 32 })}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="z-topmost w-96 max-w-[calc(100vw-28px)] p-1.5" align="start" sideOffset={6}>
                <div className="grid grid-cols-3 gap-0.5">
                    {PROJECT_ICON_OPTIONS.map((option) => {
                        const OptionIcon = option.icon;
                        const active = value === option.key;
                        return (
                            <Button
                                key={option.key}
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => onChange(option.key)}
                                className={cn(
                                    'flex items-center gap-1.5 rounded-sm border px-2 py-1.5 text-left text-[11px] transition-colors',
                                    active ? 'border-primary/60 bg-primary/10 text-foreground' : 'border-transparent hover:bg-muted/60',
                                )}
                            >
                                <OptionIcon size={13} />
                                <span className="truncate">{option.label}</span>
                            </Button>
                        );
                    })}
                </div>
            </PopoverContent>
        </Popover>
    );
};
