import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { DataTypeCell } from './DataTypeCell';

describe('DataTypeCell', () => {
    it('supports keyboard suggestion selection and commit flow', async () => {
        const onCommit = vi.fn();
        render(
            <table>
                <tbody>
                    <tr>
                        <td>
                            <DataTypeCell
                                value="varchar(20)"
                                types={['varchar(20)', 'varchar(255)', 'text']}
                                isDirty={false}
                                disabled={false}
                                onCommit={onCommit}
                            />
                        </td>
                    </tr>
                </tbody>
            </table>,
        );

        fireEvent.doubleClick(screen.getByTitle('varchar(20) (Double-click to edit)'));
        const input = screen.getByRole('textbox');
        fireEvent.change(input, { target: { value: 'var' } });
        fireEvent.keyDown(input, { key: 'ArrowDown' });
        fireEvent.keyDown(input, { key: 'ArrowDown' });
        fireEvent.keyDown(input, { key: 'Enter' });

        const editorAfterEnter = screen.queryByRole('textbox');
        if (editorAfterEnter) {
            expect((editorAfterEnter as HTMLInputElement).value).toBe('varchar(255)');
            fireEvent.keyDown(editorAfterEnter, { key: 'Tab' });
        }

        await waitFor(() => {
            expect(onCommit).toHaveBeenCalledWith('varchar(255)');
        });
    });

    it('discards edits on escape', async () => {
        const onCommit = vi.fn();
        render(
            <table>
                <tbody>
                    <tr>
                        <td>
                            <DataTypeCell
                                value="integer"
                                types={['integer', 'bigint', 'text']}
                                isDirty={false}
                                disabled={false}
                                onCommit={onCommit}
                            />
                        </td>
                    </tr>
                </tbody>
            </table>,
        );

        fireEvent.doubleClick(screen.getByTitle('integer (Double-click to edit)'));
        const input = screen.getByRole('textbox');
        fireEvent.change(input, { target: { value: 'text' } });
        fireEvent.keyDown(input, { key: 'Escape' });

        await waitFor(() => {
            expect(screen.getByTitle('integer (Double-click to edit)')).toBeInTheDocument();
        });
        expect(onCommit).not.toHaveBeenCalled();
    });
});
