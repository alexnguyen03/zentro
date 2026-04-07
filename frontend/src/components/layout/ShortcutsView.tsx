import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, RotateCcw, Search } from 'lucide-react';
import { eventToKeyToken, getCommandRegistry, type CommandId } from '../../lib/shortcutRegistry';
import { normalizeRuleBinding, type ShortcutRule } from '../../lib/shortcutRules';
import { useShortcutStore } from '../../stores/shortcutStore';
import { Button, Input, Modal } from '../ui';

type ContextMenuState = {
    x: number;
    y: number;
    rule: ShortcutRule;
    commandLabel: string;
};

type RebindState = {
    mode: 'change' | 'add';
    commandId: CommandId;
    ruleId?: string;
    initialBinding: string;
    title: string;
};

function isModifierOnlyToken(token: string): boolean {
    if (!token) return true;
    const parts = token.split('+').filter(Boolean);
    return parts.every((part) => part === 'ctrl' || part === 'alt' || part === 'shift');
}

const BindingCaptureModal: React.FC<{
    isOpen: boolean;
    title: string;
    initialBinding: string;
    onCancel: () => void;
    onConfirm: (binding: string) => void;
}> = ({ isOpen, title, initialBinding, onCancel, onConfirm }) => {
    const [useTextInput, setUseTextInput] = useState(false);
    const [binding, setBinding] = useState(initialBinding);
    const [firstStroke, setFirstStroke] = useState<string | null>(null);
    const captureRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isOpen) return;
        setUseTextInput(false);
        setBinding(initialBinding);
        setFirstStroke(null);
        window.setTimeout(() => captureRef.current?.focus(), 0);
    }, [initialBinding, isOpen]);

    const handleCaptureKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();

        if (event.key === 'Escape') {
            onCancel();
            return;
        }
        if (event.key === 'Enter' && binding.trim()) {
            onConfirm(normalizeRuleBinding(binding));
            return;
        }

        const token = eventToKeyToken(event.nativeEvent);
        if (!token || isModifierOnlyToken(token)) {
            return;
        }

        if (!firstStroke) {
            setFirstStroke(token);
            setBinding(token);
            return;
        }

        if (binding.includes(' ')) {
            setFirstStroke(token);
            setBinding(token);
            return;
        }

        setBinding(`${firstStroke} ${token}`);
        setFirstStroke(null);
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onCancel}
            title={title}
            width={560}
            layer="confirm"
            footer={(
                <>
                    <Button variant="ghost" onClick={onCancel}>Cancel</Button>
                    <Button
                        variant="default"
                        onClick={() => onConfirm(normalizeRuleBinding(binding))}
                        disabled={!binding.trim()}
                    >
                        Apply
                    </Button>
                </>
            )}
        >
            <div className="space-y-3" data-shortcut-capture="true">
                <p className="text-[13px] text-foreground">
                    Press desired key combination. Press <kbd className="font-mono text-[11px]">Enter</kbd> to confirm.
                </p>
                {!useTextInput ? (
                    <div
                        ref={captureRef}
                        tabIndex={0}
                        className="h-11 rounded-md border border-border bg-background px-3 flex items-center justify-between outline-none focus:border-success"
                        onKeyDown={handleCaptureKeyDown}
                        data-shortcut-capture="true"
                    >
                        <span className="font-mono text-[12px] text-foreground">
                            {binding || 'Press keys...'}
                        </span>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-[11px] text-muted-foreground hover:text-foreground"
                            onClick={() => setUseTextInput(true)}
                        >
                            Use text input
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-2">
                        <Input
                            autoFocus
                            value={binding}
                            onChange={(event) => setBinding(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter' && binding.trim()) {
                                    event.preventDefault();
                                    onConfirm(normalizeRuleBinding(binding));
                                }
                            }}
                            placeholder="Ctrl+K Ctrl+B"
                            className="h-10 w-full font-mono text-[12px]"
                            data-shortcut-capture="true"
                        />
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-[11px] text-muted-foreground hover:text-foreground"
                            onClick={() => setUseTextInput(false)}
                        >
                            Back to key recording
                        </Button>
                    </div>
                )}
            </div>
        </Modal>
    );
};

export const ShortcutsView: React.FC = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
    const [rebindState, setRebindState] = useState<RebindState | null>(null);
    const [conflictMessage, setConflictMessage] = useState('');
    const searchInputRef = useRef<HTMLInputElement>(null);
    const commandRegistry = getCommandRegistry();
    const commandMap = useMemo(() => new Map(commandRegistry.map((command) => [command.id, command])), [commandRegistry]);

    const { userRules, effectiveRules, setBinding, addBinding, updateRuleBinding, removeRule, restoreBinding, resetDefaults } = useShortcutStore();
    const customizedCommandIds = useMemo(() => new Set(userRules.map((rule) => rule.commandId)), [userRules]);

    useEffect(() => {
        const close = () => setContextMenu(null);
        window.addEventListener('click', close);
        return () => {
            window.removeEventListener('click', close);
        };
    }, []);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
                e.preventDefault();
                searchInputRef.current?.focus();
            }
            if (e.key === 'Escape') {
                setContextMenu(null);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const rows = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        return effectiveRules
            .map((rule) => {
                const command = commandMap.get(rule.commandId);
                if (!command) return null;
                const source = rule.source === 'system' ? 'System' : 'User';
                const rowText = `${command.label} ${command.id} ${rule.binding} ${rule.when} ${source}`.toLowerCase();
                if (query && !rowText.includes(query)) return null;
                return {
                    rule,
                    commandLabel: command.label,
                    commandId: command.id,
                    source,
                    customized: customizedCommandIds.has(command.id),
                };
            })
            .filter((row): row is NonNullable<typeof row> => Boolean(row));
    }, [commandMap, customizedCommandIds, effectiveRules, searchQuery]);

    const copyText = async (value: string) => {
        try {
            await navigator.clipboard.writeText(value);
        } catch {
            // No-op fallback for restricted clipboard contexts.
        }
    };

    const openChangeBinding = (rule: ShortcutRule, commandLabel: string) => {
        setRebindState({
            mode: 'change',
            commandId: rule.commandId,
            ruleId: rule.source === 'user' ? rule.id : undefined,
            initialBinding: rule.binding,
            title: `Change Keybinding — ${commandLabel}`,
        });
        setContextMenu(null);
    };

    const openAddBinding = (rule: ShortcutRule, commandLabel: string) => {
        setRebindState({
            mode: 'add',
            commandId: rule.commandId,
            initialBinding: '',
            title: `Add Keybinding — ${commandLabel}`,
        });
        setContextMenu(null);
    };

    const resolveConflictMessage = (conflictWith?: CommandId): string => {
        if (!conflictWith) return 'Shortcut conflict detected.';
        const label = commandMap.get(conflictWith)?.label || conflictWith;
        return `Shortcut conflict with "${label}".`;
    };

    const handleConfirmBinding = async (binding: string) => {
        if (!rebindState) return;
        const normalized = normalizeRuleBinding(binding);
        if (!normalized) {
            setRebindState(null);
            return;
        }

        if (rebindState.mode === 'add') {
            const result = await addBinding(rebindState.commandId, normalized, '');
            if (!result.ok) {
                setConflictMessage(resolveConflictMessage(result.conflictWith));
            }
            setRebindState(null);
            return;
        }

        if (rebindState.ruleId) {
            const result = await updateRuleBinding(rebindState.ruleId, normalized);
            if (!result.ok) {
                setConflictMessage(resolveConflictMessage(result.conflictWith));
            }
            setRebindState(null);
            return;
        }

        const result = await setBinding(rebindState.commandId, normalized);
        if (!result.ok) {
            setConflictMessage(resolveConflictMessage(result.conflictWith));
        }
        setRebindState(null);
    };

    return (
        <div className="flex flex-col h-full bg-background overflow-hidden">
            <div className="z-sticky flex h-16 items-center justify-between border-b border-border/10 bg-background px-6">
                <div className="flex items-center gap-3 text-foreground">
                    <div className="p-2 rounded-md bg-accent/5 text-accent">
                        <Keyboard size={18} />
                    </div>
                    <h1 className="text-[15px] font-bold tracking-tight">Keyboard Shortcuts</h1>
                </div>

                <div className="flex-1 flex justify-center max-w-2xl px-6">
                    <div className="relative w-full max-w-xl">
                        <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            ref={searchInputRef}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search commands, keybindings, when..."
                            className="h-9 border-input/70 bg-muted/40 pl-8 focus:bg-background"
                        />
                    </div>
                </div>

                <Button
                    variant="ghost"
                    size="default"
                    className="gap-2 font-bold text-[11px] tracking-widest uppercase"
                    onClick={() => resetDefaults().catch((err) => console.error('reset shortcuts failed', err))}
                    title="Reset all shortcuts to default"
                >
                    <RotateCcw size={14} />
                    <span className="hidden xl:inline">Reset All</span>
                </Button>
            </div>

            <div className="flex-1 overflow-auto p-5">
                <div className="rounded-md border border-border/30 overflow-hidden">
                    <table className="w-full text-[12px] table-fixed">
                        <thead className="bg-card/70 border-b border-border/30">
                            <tr>
                                <th className="text-left px-3 py-2 font-semibold text-muted-foreground w-[34%]">Command</th>
                                <th className="text-left px-3 py-2 font-semibold text-muted-foreground w-[22%]">Keybinding</th>
                                <th className="text-left px-3 py-2 font-semibold text-muted-foreground w-[30%]">When</th>
                                <th className="text-left px-3 py-2 font-semibold text-muted-foreground w-[14%]">Source</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row) => (
                                <tr
                                    key={row.rule.id}
                                    className="border-b border-border/20 hover:bg-card/30"
                                    onContextMenu={(event) => {
                                        event.preventDefault();
                                        setContextMenu({
                                            x: event.clientX,
                                            y: event.clientY,
                                            rule: row.rule,
                                            commandLabel: row.commandLabel,
                                        });
                                    }}
                                >
                                    <td className="px-3 py-2">
                                        <div className="truncate text-foreground font-medium">{row.commandLabel}</div>
                                        <div className="truncate text-[11px] text-muted-foreground">{row.commandId}</div>
                                        {row.customized && (
                                            <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded bg-warning/20 text-warning">Customized</span>
                                        )}
                                    </td>
                                    <td className="px-3 py-2 text-foreground">
                                        <span className="font-mono text-[11px] rounded border border-border bg-card px-1.5 py-0.5">
                                            {row.rule.binding || '-'}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2 text-muted-foreground font-mono text-[11px] truncate">
                                        {row.rule.when || '-'}
                                    </td>
                                    <td className="px-3 py-2 text-muted-foreground">{row.source}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {rows.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-24 text-muted-foreground/40">
                        <Search size={42} strokeWidth={1} className="mb-4 opacity-20" />
                        <p className="text-[14px] font-medium">No shortcuts match "{searchQuery}"</p>
                    </div>
                )}
            </div>

            {contextMenu && (
                <div
                    className="fixed z-modal bg-card border border-border rounded-md shadow-elevation-lg min-w-[220px] py-1"
                    style={{ left: contextMenu.x, top: contextMenu.y }}
                    onClick={(event) => event.stopPropagation()}
                >
                    <Button variant="ghost" className="h-auto w-full justify-start rounded-none px-3 py-1.5 text-[12px]" onClick={() => copyText(contextMenu.rule.binding)}>Copy</Button>
                    <Button variant="ghost" className="h-auto w-full justify-start rounded-none px-3 py-1.5 text-[12px]" onClick={() => copyText(contextMenu.rule.commandId)}>Copy Command ID</Button>
                    <Button variant="ghost" className="h-auto w-full justify-start rounded-none px-3 py-1.5 text-[12px]" onClick={() => copyText(contextMenu.commandLabel)}>Copy Command Title</Button>
                    <div className="h-px bg-border/40 my-1" />
                    <Button variant="ghost" className="h-auto w-full justify-start rounded-none px-3 py-1.5 text-[12px]" onClick={() => openChangeBinding(contextMenu.rule, contextMenu.commandLabel)}>Change Keybinding...</Button>
                    <Button variant="ghost" className="h-auto w-full justify-start rounded-none px-3 py-1.5 text-[12px]" onClick={() => openAddBinding(contextMenu.rule, contextMenu.commandLabel)}>Add Keybinding...</Button>
                    <Button
                        variant="ghost"
                        className="h-auto w-full justify-start rounded-none px-3 py-1.5 text-[12px] disabled:opacity-40 disabled:cursor-not-allowed"
                        onClick={() => {
                            void removeRule(contextMenu.rule.id);
                            setContextMenu(null);
                        }}
                        disabled={contextMenu.rule.source !== 'user'}
                    >
                        Remove Keybinding
                    </Button>
                    <Button
                        variant="ghost"
                        className="h-auto w-full justify-start rounded-none px-3 py-1.5 text-[12px]"
                        onClick={() => {
                            void restoreBinding(contextMenu.rule.commandId);
                            setContextMenu(null);
                        }}
                    >
                        Reset Keybinding
                    </Button>
                </div>
            )}

            <BindingCaptureModal
                isOpen={Boolean(rebindState)}
                title={rebindState?.title || 'Change Keybinding'}
                initialBinding={rebindState?.initialBinding || ''}
                onCancel={() => setRebindState(null)}
                onConfirm={(binding) => { void handleConfirmBinding(binding); }}
            />

            <Modal
                isOpen={Boolean(conflictMessage)}
                onClose={() => setConflictMessage('')}
                title="Shortcut Conflict"
                width={420}
                layer="confirm"
                footer={(
                    <Button variant="default" autoFocus onClick={() => setConflictMessage('')} className="px-4">
                        OK
                    </Button>
                )}
            >
                <p className="text-[13px] leading-relaxed text-foreground">{conflictMessage}</p>
            </Modal>
        </div>
    );
};
