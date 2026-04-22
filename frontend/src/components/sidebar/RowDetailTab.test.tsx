import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RowDetailTab } from './RowDetailTab';
import { useRowDetailStore } from '../../stores/rowDetailStore';
import { useSidebarUiStore } from '../../stores/sidebarUiStore';
import { STORAGE_KEY } from '../../lib/constants';

const { toastSuccessMock, toastErrorMock, setClipboardTextMock } = vi.hoisted(() => ({
    toastSuccessMock: vi.fn(),
    toastErrorMock: vi.fn(),
    setClipboardTextMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../layout/Toast', () => ({
    useToast: () => ({
        toast: {
            success: toastSuccessMock,
            error: toastErrorMock,
        },
    }),
}));

vi.mock('../../services/clipboardService', () => ({
    setClipboardText: setClipboardTextMock,
}));

vi.mock('../viewers/JsonViewer', () => ({
    JsonViewer: ({ value }: { value: string }) => <pre data-testid="json-viewer">{value}</pre>,
}));

describe('RowDetailTab', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        useRowDetailStore.setState({ detail: null });
        localStorage.removeItem(STORAGE_KEY.SIDEBAR_UI);
        useSidebarUiStore.setState({ contextStates: {} });
    });

    it('edits and commits field values, then disables editor in select mode', () => {
        const onSave = vi.fn();
        useRowDetailStore.setState({
            detail: {
                columns: ['name'],
                row: ['Alice'],
                primaryKeys: [],
                onSave,
            },
        });

        render(<RowDetailTab />);

        const editor = screen.getByTitle('Click to edit | Enter to save | Esc to cancel');
        fireEvent.change(editor, { target: { value: 'Alice 2' } });
        fireEvent.keyDown(editor, { key: 'Enter' });
        expect(onSave).toHaveBeenCalledWith(0, 'Alice 2');

        fireEvent.change(editor, { target: { value: 'Alice 3' } });
        fireEvent.keyDown(editor, { key: 'Escape' });
        expect((screen.getByTitle('Click to edit | Enter to save | Esc to cancel') as HTMLTextAreaElement).value).toBe('Alice');

        fireEvent.click(screen.getByTitle('Toggle selection mode for custom JSON copy'));
        expect(screen.queryByTitle('Click to edit | Enter to save | Esc to cancel')).toBeNull();
        expect(screen.getByRole('checkbox')).toBeInTheDocument();
    });

    it('copies selected fields as JSON in selection mode', async () => {
        useRowDetailStore.setState({
            detail: {
                columns: ['id', 'name'],
                row: ['1', 'Alice'],
                primaryKeys: ['id'],
            },
        });

        render(<RowDetailTab />);

        fireEvent.click(screen.getByTitle('Toggle selection mode for custom JSON copy'));
        fireEvent.click(screen.getAllByRole('checkbox')[1]);
        fireEvent.click(screen.getByTitle('Copy selected fields as JSON'));

        await waitFor(() => {
            expect(setClipboardTextMock).toHaveBeenCalledWith(JSON.stringify({ name: 'Alice' }, null, 2));
        });
        expect(toastSuccessMock).toHaveBeenCalledWith('Copied 1 fields as JSON');
        expect(toastErrorMock).not.toHaveBeenCalled();
    });
});
