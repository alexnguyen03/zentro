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

        const handler = (e: KeyboardEvent) => {
            if (isTypingTarget(e.target)) return;
            const token = eventToKeyToken(e);
            const now = Date.now();
            const inMonaco = Boolean((e.target as HTMLElement | null)?.closest('.monaco-editor'));

            if (inMonaco && token === 'ctrl+enter') {
                return;
            }

            for (const entry of commands) {
                const binding = normalizeBinding(bindings[entry.id] || entry.defaultBinding);
                const parts = binding.split(' ');
                if (parts.length === 2) {
                    if (token === parts[0]) {
                        e.preventDefault();
                        setChord(parts[0]);
                        return;
                    }
                    if (chordStart === parts[0] && now <= chordUntil && token === parts[1]) {
                        e.preventDefault();
                        setChord(null);
                        execute(entry);
                        return;
                    }
                    continue;
                }
                if (token === parts[0]) {
                    e.preventDefault();
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

