import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ShortcutsView } from './ShortcutsView';

const commandRegistryMock = [
    {
        id: 'editor.newTab',
        label: 'New Query Tab',
        category: 'Editor',
        defaultBinding: 'Ctrl+T',
        defaultWhen: '',
        action: vi.fn(),
    },
    {
        id: 'layout.toggleSidebar',
        label: 'Toggle Left Sidebar',
        category: 'Layout',
        defaultBinding: 'Ctrl+B',
        defaultWhen: '',
        action: vi.fn(),
    },
] as const;

const setBindingMock = vi.fn().mockResolvedValue({ ok: true });
const addBindingMock = vi.fn().mockResolvedValue({ ok: true });
const updateRuleBindingMock = vi.fn().mockResolvedValue({ ok: true });
const removeRuleMock = vi.fn().mockResolvedValue(undefined);
const restoreBindingMock = vi.fn().mockResolvedValue(undefined);
const resetDefaultsMock = vi.fn().mockResolvedValue(undefined);

const shortcutStoreState = {
    bindings: {
        'editor.newTab': 'Ctrl+Y',
        'layout.toggleSidebar': 'Ctrl+B',
    },
    userRules: [
        {
            id: 'u1',
            commandId: 'editor.newTab',
            binding: 'ctrl+y',
            when: '',
            source: 'user',
            order: 0,
        },
    ],
    effectiveRules: [
        {
            id: 'u1',
            commandId: 'editor.newTab',
            binding: 'ctrl+y',
            when: '',
            source: 'user',
            order: 0,
        },
        {
            id: 'system:layout.toggleSidebar',
            commandId: 'layout.toggleSidebar',
            binding: 'ctrl+b',
            when: '',
            source: 'system',
            order: 1,
        },
    ],
    setBinding: setBindingMock,
    addBinding: addBindingMock,
    updateRuleBinding: updateRuleBindingMock,
    removeRule: removeRuleMock,
    restoreBinding: restoreBindingMock,
    resetDefaults: resetDefaultsMock,
};

vi.mock('../../lib/shortcutRegistry', () => ({
    getCommandRegistry: () => commandRegistryMock,
    eventToKeyToken: () => 'ctrl+k',
}));

vi.mock('../../stores/shortcutStore', () => ({
    useShortcutStore: (selector?: (state: typeof shortcutStoreState) => unknown) => (
        selector ? selector(shortcutStoreState) : shortcutStoreState
    ),
}));

vi.mock('./Modal', () => ({
    Modal: ({
        isOpen,
        title,
        children,
        footer,
    }: {
        isOpen: boolean;
        title: string;
        children: React.ReactNode;
        footer: React.ReactNode;
    }) => (isOpen ? (
        <div>
            <div>{title}</div>
            <div>{children}</div>
            <div>{footer}</div>
        </div>
    ) : null),
}));

describe('ShortcutsView', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders table columns and rows', () => {
        render(<ShortcutsView />);
        expect(screen.getByText('Command')).toBeInTheDocument();
        expect(screen.getByText('Keybinding')).toBeInTheDocument();
        expect(screen.getByText('When')).toBeInTheDocument();
        expect(screen.getByText('Source')).toBeInTheDocument();
        expect(screen.getByText('New Query Tab')).toBeInTheDocument();
        expect(screen.getByText('Toggle Left Sidebar')).toBeInTheDocument();
    });

    it('filters rows by search query', () => {
        render(<ShortcutsView />);
        fireEvent.change(screen.getByPlaceholderText('Search commands, keybindings, when...'), {
            target: { value: 'missing-shortcut' },
        });
        expect(screen.getByText('No shortcuts match "missing-shortcut"')).toBeInTheDocument();
    });

    it('opens context menu and triggers reset action', async () => {
        render(<ShortcutsView />);
        fireEvent.contextMenu(screen.getByText('New Query Tab'));
        fireEvent.click(screen.getByText('Reset Keybinding'));
        await waitFor(() => expect(restoreBindingMock).toHaveBeenCalledWith('editor.newTab'));
    });

    it('reset all keeps behavior', async () => {
        render(<ShortcutsView />);
        fireEvent.click(screen.getByTitle('Reset all shortcuts to default'));
        await waitFor(() => expect(resetDefaultsMock).toHaveBeenCalledTimes(1));
    });
});
