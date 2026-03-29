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
        action: vi.fn(),
    },
    {
        id: 'layout.toggleSidebar',
        label: 'Toggle Left Sidebar',
        category: 'Layout',
        defaultBinding: 'Ctrl+B',
        action: vi.fn(),
    },
    {
        id: 'app.reload',
        label: 'Reload Application',
        category: 'App',
        defaultBinding: 'Ctrl+Shift+R',
        action: vi.fn(),
    },
] as const;

const setBindingMock = vi.fn().mockResolvedValue({ ok: true });
const restoreBindingMock = vi.fn().mockResolvedValue(undefined);
const resetDefaultsMock = vi.fn().mockResolvedValue(undefined);

const shortcutStoreState = {
    bindings: {
        'editor.newTab': 'Ctrl+Y',
        'layout.toggleSidebar': 'Ctrl+B',
        'app.reload': 'Ctrl+Shift+R',
    },
    setBinding: setBindingMock,
    restoreBinding: restoreBindingMock,
    resetDefaults: resetDefaultsMock,
};

vi.mock('../../lib/shortcutRegistry', () => ({
    getCommandRegistry: () => commandRegistryMock,
}));

vi.mock('../../stores/shortcutStore', () => ({
    useShortcutStore: (selector: (state: typeof shortcutStoreState) => unknown) => selector(shortcutStoreState),
}));

vi.mock('../ui', async () => {
    const actual = await vi.importActual<typeof import('../ui')>('../ui');
    return {
        ...actual,
        PromptModal: ({ isOpen, onConfirm }: { isOpen: boolean; onConfirm: (value: string) => void }) => (isOpen ? (
            <button onClick={() => onConfirm('Ctrl+K')}>Confirm Rebind</button>
        ) : null),
        AlertModal: ({ isOpen, message }: { isOpen: boolean; message: string }) => (isOpen ? <div>{message}</div> : null),
    };
});

describe('ShortcutsView', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders category sections in order and without 2-column layout classes', () => {
        const { container } = render(<ShortcutsView />);
        const headings = screen.getAllByRole('heading', { level: 2 }).map((node) => node.textContent);
        expect(headings).toEqual(['Editor', 'Layout', 'App']);
        expect(container.querySelector('.lg\\:col-span-4')).toBeNull();
        expect(container.querySelector('.lg\\:col-span-8')).toBeNull();
    });

    it('filters shortcuts by search and shows empty state', () => {
        render(<ShortcutsView />);
        fireEvent.change(screen.getByPlaceholderText('Search shortcuts...'), {
            target: { value: 'missing-shortcut' },
        });

        expect(screen.getByText('No shortcuts match "missing-shortcut"')).toBeInTheDocument();
    });

    it('keeps reset, rebind, and restore behaviors working', async () => {
        render(<ShortcutsView />);

        fireEvent.click(screen.getByTitle('Reset all shortcuts to default'));
        await waitFor(() => expect(resetDefaultsMock).toHaveBeenCalledTimes(1));

        fireEvent.click(screen.getAllByRole('button', { name: 'Rebind' })[0]);
        fireEvent.click(screen.getByRole('button', { name: 'Confirm Rebind' }));
        await waitFor(() => expect(setBindingMock).toHaveBeenCalledWith('editor.newTab', 'Ctrl+K'));

        fireEvent.click(screen.getAllByRole('button', { name: 'Restore' })[0]);
        await waitFor(() => expect(restoreBindingMock).toHaveBeenCalledWith('editor.newTab'));
    });
});
