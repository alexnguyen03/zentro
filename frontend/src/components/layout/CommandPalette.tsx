import React, { useMemo, useCallback, useState } from 'react';
import { buildCommands, CommandItem, CommandCategory } from '../../lib/commands';
import { useLayoutStore } from '../../stores/layoutStore';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem as ShadCommandItem,
    CommandList,
    CommandShortcut,
    OverlayDialog,
} from '../ui';

const CATEGORY_ORDER: CommandCategory[] = ['Editor', 'View', 'Layout', 'Connection', 'App'];

export const CommandPalette: React.FC = () => {
    const setShowCommandPalette = useLayoutStore((state) => state.setShowCommandPalette);

    const [query, setQuery] = useState('');

    // Re-build commands on each render so actions get fresh store state
    const allCommands = buildCommands();

    const filtered = useMemo<CommandItem[]>(() => {
        const q = query.trim().toLowerCase();
        if (!q) return allCommands;

        return allCommands
            .map((command) => ({
                command,
                score: fuzzyScore(q, `${command.label} ${command.category} ${command.keybinding ?? ''}`.toLowerCase()),
            }))
            .filter((entry) => entry.score > 0)
            .sort((a, b) => b.score - a.score)
            .map((entry) => entry.command);
    }, [query, allCommands]);

    const grouped = useMemo(
        () =>
            CATEGORY_ORDER
                .map((category) => [category, filtered.filter((command) => command.category === category)] as const)
                .filter((entry) => entry[1].length > 0),
        [filtered],
    );

    const close = useCallback(() => setShowCommandPalette(false), [setShowCommandPalette]);

    const execute = useCallback(
        (command: CommandItem) => {
            close();
            // Ensure overlay is unmounted first.
            setTimeout(() => command.action(), 50);
        },
        [close],
    );

    return (
        <OverlayDialog onClose={close} className="items-start pt-[15vh]">
            <div
                className="w-[560px] max-h-[420px] flex flex-col bg-card border border-border rounded-sm shadow-[0_20px_60px_rgba(0,0,0,0.5)] overflow-hidden animate-in slide-in-from-top-3 duration-150"
                onClick={(event) => event.stopPropagation()}
            >
                <Command shouldFilter={false} loop className="h-full bg-card text-foreground">
                    <div className="relative">
                        <CommandInput
                            value={query}
                            onValueChange={setQuery}
                            placeholder="Search commands..."
                        />
                        <kbd className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 rounded-sm border border-border bg-background px-1.5 py-0.5 font-mono text-label text-muted-foreground">
                            Esc
                        </kbd>
                    </div>

                    <CommandList className="max-h-[330px] py-1">
                        <CommandEmpty>
                            No commands found for <span className="font-medium">&quot;{query}&quot;</span>
                        </CommandEmpty>
                        {grouped.map(([category, items]) => (
                            <CommandGroup key={category} heading={category}>
                                {items.map((command) => (
                                    <ShadCommandItem
                                        key={command.id}
                                        value={`${command.label} ${command.category} ${command.keybinding ?? ''}`}
                                        onSelect={() => execute(command)}
                                        className="group data-[selected=true]:bg-success/10"
                                    >
                                        <span className="font-medium group-data-[selected=true]:text-success">
                                            {command.label}
                                        </span>
                                        {command.keybinding && (
                                            <CommandShortcut className="flex items-center gap-0.5 tracking-normal">
                                                {command.keybinding.split(' ').map((keyPart, index) => (
                                                    <kbd
                                                        key={`${command.id}_key_${index}`}
                                                        className="rounded-sm border border-border bg-background px-1.5 py-px font-mono text-label text-muted-foreground"
                                                    >
                                                        {keyPart}
                                                    </kbd>
                                                ))}
                                            </CommandShortcut>
                                        )}
                                    </ShadCommandItem>
                                ))}
                            </CommandGroup>
                        ))}
                    </CommandList>
                </Command>

                <div className="px-4 py-2 border-t border-border bg-background/50 shrink-0 flex items-center gap-4 text-label text-muted-foreground select-none">
                    <span>
                        <kbd className="font-mono">Up/Down</kbd> navigate
                    </span>
                    <span>
                        <kbd className="font-mono">Enter</kbd> execute
                    </span>
                    <span>
                        <kbd className="font-mono">Esc</kbd> close
                    </span>
                </div>
            </div>
        </OverlayDialog>
    );
};

function fuzzyScore(needle: string, haystack: string): number {
    if (!needle) return 1;
    if (haystack.includes(needle)) return 1000 - haystack.indexOf(needle);

    let score = 0;
    let hIdx = 0;
    let streak = 0;
    for (let i = 0; i < needle.length; i++) {
        const ch = needle[i];
        let found = false;
        while (hIdx < haystack.length) {
            if (haystack[hIdx] === ch) {
                found = true;
                streak++;
                score += 10 + streak * 2;
                hIdx++;
                break;
            }
            streak = 0;
            hIdx++;
        }
        if (!found) return 0;
    }
    return score;
}
