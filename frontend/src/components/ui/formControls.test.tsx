import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { FormField } from './FormField';
import { SelectField } from './SelectField';
import { SwitchField } from './SwitchField';
import { SearchField } from './SearchField';

describe('shared form controls', () => {
    it('renders FormField label and hint', () => {
        render(
            <FormField label="Theme" hint="Pick your preferred theme.">
                <input aria-label="Theme input" />
            </FormField>,
        );

        expect(screen.getByText('Theme')).toBeInTheDocument();
        expect(screen.getByText('Pick your preferred theme.')).toBeInTheDocument();
    });

    it('renders SelectField and emits change events', () => {
        const onChange = vi.fn();
        render(
            <SelectField aria-label="Theme Select" onChange={onChange} value="light">
                <option value="light">Light</option>
                <option value="dark">Dark</option>
            </SelectField>,
        );

        const trigger = screen.getByRole('combobox', { name: /theme select/i });
        fireEvent.click(trigger);
        fireEvent.click(screen.getByRole('option', { name: 'Dark' }));
        expect(onChange).toHaveBeenCalledTimes(1);
    });

    it('renders SwitchField and emits boolean checked state', () => {
        const onChange = vi.fn();
        render(<SwitchField aria-label="Auto update" checked={false} onChange={onChange} />);

        fireEvent.click(screen.getByLabelText('Auto update'));
        expect(onChange).toHaveBeenCalledWith(true);
    });

    it('renders SearchField with placeholder and value updates', () => {
        const onChange = vi.fn();
        render(
            <SearchField
                aria-label="Search settings"
                placeholder="Search settings..."
                value=""
                onChange={onChange}
            />,
        );

        const input = screen.getByLabelText('Search settings');
        fireEvent.change(input, { target: { value: 'theme' } });
        expect(onChange).toHaveBeenCalledTimes(1);
    });
});
