import { useEffect } from 'react';
import { eventToKeyToken, getCommandRegistry, normalizeBinding } from '../../lib/shortcutRegistry';
import { useShortcutStore } from '../../stores/shortcutStore';
import { appLogger } from '../../lib/logger';

export function useGlobalShortcuts(toast: { error: (message: string) => void }) {
    const { bindings, chordStart, chordUntil, setChord } = useShortcutStore();

    useEffect(() => {
        const commands = getCommandRegistry();

        const isTypingTarget = (target: EventTarget | null) => {
            const el = target as HTMLElement | null;
            if (!el) return false;
            if (el.closest('.monaco-editor')) return false;
            return Boolean(el.closest('input, textarea, [contenteditable="true"]'));
        };

        const execute = (entry: (typeof commands)[number]) => {
            Promise.resolve(entry.action()).catch((err) => {
                appLogger.error(`shortcut ${entry.id} failed`, err);
                toast.error(`Shortcut failed: ${entry.label}`);
            });
        };

        const consumeEvent = (e: KeyboardEvent) => {
            e.preventDefault();
            e.stopPropagation();
        };

        const handler = (e: KeyboardEvent) => {
            if (isTypingTarget(e.target)) return;
            const target = e.target as HTMLElement | null;
            const inSqlMonaco = Boolean(target?.closest('.zentro-sql-editor .monaco-editor'));
            const isCtrlSpace =
                (e.ctrlKey || e.metaKey) &&
                !e.altKey &&
                !e.shiftKey &&
                (e.code === 'Space' || e.key === ' ' || e.key.toLowerCase() === 'spacebar');

            // SQL Monaco should keep Ctrl/Cmd+Space for suggest, never global shortcut.
            if (inSqlMonaco && isCtrlSpace) {
                return;
            }

            const token = eventToKeyToken(e);
            const now = Date.now();
            const inFilterMonaco = Boolean(target?.closest('.zentro-filter-monaco .monaco-editor'));

            // Filter editor should not trigger global run query on Ctrl/Cmd+Enter.
            if (inFilterMonaco && token === 'ctrl+enter') {
                return;
            }

            for (const entry of commands) {
                const binding = normalizeBinding(bindings[entry.id] || entry.defaultBinding);
                const parts = binding.split(' ');
                if (parts.length === 2) {
                    if (token === parts[0]) {
                        consumeEvent(e);
                        setChord(parts[0]);
                        return;
                    }
                    if (chordStart === parts[0] && now <= chordUntil && token === parts[1]) {
                        consumeEvent(e);
                        setChord(null);
                        execute(entry);
                        return;
                    }
                    continue;
                }
                if (token === parts[0]) {
                    consumeEvent(e);
                    execute(entry);
                    return;
                }
            }

            if (chordStart && now > chordUntil) {
                setChord(null);
            }
        };

        window.addEventListener('keydown', handler, true);
        return () => window.removeEventListener('keydown', handler, true);
    }, [bindings, chordStart, chordUntil, setChord, toast]);
}
