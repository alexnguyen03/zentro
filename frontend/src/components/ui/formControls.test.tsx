import React from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Input } from './Input';
import { Label } from './label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';
import { Separator } from './separator';
import { Switch } from './switch';

describe('shadcn primitives', () => {
    it('renders Label with Input field', () => {
        render(
            <div>
                <Label htmlFor="theme-input">Theme</Label>
                <Input id="theme-input" aria-label="Theme input" />
            </div>,
        );

        expect(screen.getByText('Theme')).toBeInTheDocument();
        expect(screen.getByLabelText('Theme input')).toBeInTheDocument();
    });

    it('renders Select and updates selected value', () => {
        const ThemeSelect = () => {
            const [value, setValue] = React.useState('light');
            return (
                <Select value={value} onValueChange={setValue}>
                    <SelectTrigger aria-label="Theme Select">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="light">Light</SelectItem>
                        <SelectItem value="dark">Dark</SelectItem>
                    </SelectContent>
                </Select>
            );
        };

        render(<ThemeSelect />);

        const trigger = screen.getByRole('combobox', { name: /theme select/i });
        fireEvent.click(trigger);
        fireEvent.click(screen.getByRole('option', { name: 'Dark' }));
        expect(trigger).toHaveTextContent('Dark');
    });

    it('renders Switch and toggles checked state', () => {
        const Toggle = () => {
            const [checked, setChecked] = React.useState(false);
            return <Switch aria-label="Auto update" checked={checked} onCheckedChange={setChecked} />;
        };

        render(<Toggle />);

        const control = screen.getByRole('switch', { name: 'Auto update' });
        fireEvent.click(control);
        expect(control).toHaveAttribute('data-state', 'checked');
    });

    it('renders Separator primitive', () => {
        render(<Separator data-testid="divider" />);
        expect(screen.getByTestId('divider')).toBeInTheDocument();
    });
});
