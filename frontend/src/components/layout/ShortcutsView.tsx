import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, RotateCcw, Search } from 'lucide-react';
import { eventToKeyToken, getCommandRegistry, type CommandId } from '../../lib/shortcutRegistry';
import { normalizeRuleBinding, type ShortcutRule } from '../../lib/shortcutRules';
import { useShortcutStore } from '../../stores/shortcutStore';
import { AlertModal, Button, SearchField } from '../ui';
import { Modal } from './Modal';

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
                        variant="primary"
                        onClick={() => onConfirm(normalizeRuleBinding(binding))}
                        disabled={!binding.trim()}
                    >
                        Apply
                    </Button>
                </>
            )}
        >
            <div className="space-y-3" data-shortcut-capture="true">
                <p className="text-[13px] text-text-primary">
                    Press desired key combination. Press <kbd className="font-mono text-[11px]">Enter</kbd> to confirm.
                </p>
                {!useTextInput ? (
                    <div
                        ref={captureRef}
                        tabIndex={0}
                        className="h-11 rounded-md border border-border bg-bg-primary px-3 flex items-center justify-between outline-none focus:border-success"
                        onKeyDown={handleCaptureKeyDown}
                        data-shortcut-capture="true"
                    >
                        <span className="font-mono text-[12px] text-text-primary">
                            {binding || 'Press keys...'}
                        </span>
                        <button
                            type="button"
                            className="text-[11px] text-text-muted hover:text-text-primary"
                            onClick={() => setUseTextInput(true)}
                        >
                            Use text input
                        </button>
                    </div>
                ) : (
                    <div className="space-y-2">
                        <input
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
                            className="w-full h-10 rounded-md border border-border bg-bg-primary px-3 text-[12px] font-mono outline-none focus:border-success"
                            data-shortcut-capture="true"
                        />
                        <button
                            type="button"
                            className="text-[11px] text-text-muted hover:text-text-primary"
                            onClick={() => setUseTextInput(false)}
                        >
                            Back to key recording
                        </button>
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
        <div className="flex flex-col h-full bg-bg-primary overflow-hidden">
            <div className="z-sticky flex h-16 items-center justify-between border-b border-border/10 bg-bg-primary px-6">
                <div className="flex items-center gap-3 text-text-primary">
                    <div className="p-2 rounded-md bg-accent/5 text-accent">
                        <Keyboard size={18} />
                    </div>
                    <h1 className="text-[15px] font-bold tracking-tight">Keyboard Shortcuts</h1>
                </div>

                <div className="flex-1 flex justify-center max-w-2xl px-6">
                    <SearchField
                        ref={searchInputRef}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search commands, keybindings, when..."
                        wrapperClassName="max-w-xl"
                    />
                </div>

                <Button
                    variant="ghost"
                    size="md"
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
                        <thead className="bg-bg-secondary/70 border-b border-border/30">
                            <tr>
                                <th className="text-left px-3 py-2 font-semibold text-text-secondary w-[34%]">Command</th>
                                <th className="text-left px-3 py-2 font-semibold text-text-secondary w-[22%]">Keybinding</th>
                                <th className="text-left px-3 py-2 font-semibold text-text-secondary w-[30%]">When</th>
                                <th className="text-left px-3 py-2 font-semibold text-text-secondary w-[14%]">Source</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row) => (
                                <tr
                                    key={row.rule.id}
                                    className="border-b border-border/20 hover:bg-bg-secondary/30"
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
                                        <div className="truncate text-text-primary font-medium">{row.commandLabel}</div>
                                        <div className="truncate text-[11px] text-text-muted">{row.commandId}</div>
                                        {row.customized && (
                                            <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded bg-warning/20 text-warning">Customized</span>
                                        )}
                                    </td>
                                    <td className="px-3 py-2 text-text-primary">
                                        <span className="font-mono text-[11px] rounded border border-border bg-bg-secondary px-1.5 py-0.5">
                                            {row.rule.binding || '-'}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2 text-text-secondary font-mono text-[11px] truncate">
                                        {row.rule.when || '-'}
                                    </td>
                                    <td className="px-3 py-2 text-text-secondary">{row.source}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {rows.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-24 text-text-muted/40">
                        <Search size={42} strokeWidth={1} className="mb-4 opacity-20" />
                        <p className="text-[14px] font-medium">No shortcuts match "{searchQuery}"</p>
                    </div>
                )}
            </div>

            {contextMenu && (
                <div
                    className="fixed z-modal bg-bg-secondary border border-border rounded-md shadow-elevation-lg min-w-[220px] py-1"
                    style={{ left: contextMenu.x, top: contextMenu.y }}
                    onClick={(event) => event.stopPropagation()}
                >
                    <button className="w-full text-left px-3 py-1.5 text-[12px] hover:bg-bg-tertiary" onClick={() => copyText(contextMenu.rule.binding)}>Copy</button>
                    <button className="w-full text-left px-3 py-1.5 text-[12px] hover:bg-bg-tertiary" onClick={() => copyText(contextMenu.rule.commandId)}>Copy Command ID</button>
                    <button className="w-full text-left px-3 py-1.5 text-[12px] hover:bg-bg-tertiary" onClick={() => copyText(contextMenu.commandLabel)}>Copy Command Title</button>
                    <div className="h-px bg-border/40 my-1" />
                    <button className="w-full text-left px-3 py-1.5 text-[12px] hover:bg-bg-tertiary" onClick={() => openChangeBinding(contextMenu.rule, contextMenu.commandLabel)}>Change Keybinding...</button>
                    <button className="w-full text-left px-3 py-1.5 text-[12px] hover:bg-bg-tertiary" onClick={() => openAddBinding(contextMenu.rule, contextMenu.commandLabel)}>Add Keybinding...</button>
                    <button
                        className="w-full text-left px-3 py-1.5 text-[12px] hover:bg-bg-tertiary disabled:opacity-40 disabled:cursor-not-allowed"
                        onClick={() => {
                            void removeRule(contextMenu.rule.id);
                            setContextMenu(null);
                        }}
                        disabled={contextMenu.rule.source !== 'user'}
                    >
                        Remove Keybinding
                    </button>
                    <button
                        className="w-full text-left px-3 py-1.5 text-[12px] hover:bg-bg-tertiary"
                        onClick={() => {
                            void restoreBinding(contextMenu.rule.commandId);
                            setContextMenu(null);
                        }}
                    >
                        Reset Keybinding
                    </button>
                </div>
            )}

            <BindingCaptureModal
                isOpen={Boolean(rebindState)}
                title={rebindState?.title || 'Change Keybinding'}
                initialBinding={rebindState?.initialBinding || ''}
                onCancel={() => setRebindState(null)}
                onConfirm={(binding) => { void handleConfirmBinding(binding); }}
            />

            <AlertModal
                isOpen={Boolean(conflictMessage)}
                title="Shortcut Conflict"
                message={conflictMessage}
                onClose={() => setConflictMessage('')}
            />
        </div>
    );
};
