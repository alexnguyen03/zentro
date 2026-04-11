import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from './Button';
import { Input } from './Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';
import { Switch } from './switch';
import { AppShell, DataEmpty, FormSection } from './app-shell-pattern';

describe('design system contract', () => {
    it('applies primitive control contract props', () => {
        render(
            <div>
                <Button tone="danger" state="loading" density="compact">Delete</Button>
                <Input aria-label="Name" tone="warning" state="error" density="compact" />
                <Switch aria-label="Auto update" tone="success" state="default" />
            </div>,
        );

        expect(screen.getByRole('button', { name: 'Delete' })).toHaveAttribute('data-tone', 'danger');
        expect(screen.getByRole('button', { name: 'Delete' })).toHaveAttribute('data-state', 'loading');
        expect(screen.getByLabelText('Name')).toHaveAttribute('data-state', 'error');
        expect(screen.getByRole('switch', { name: 'Auto update' })).toHaveAttribute('data-tone', 'success');
    });

    it('applies select trigger contract props', () => {
        render(
            <Select defaultValue="light">
                <SelectTrigger aria-label="Theme select" tone="warning" state="error">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="dark">Dark</SelectItem>
                </SelectContent>
            </Select>,
        );

        expect(screen.getByRole('combobox', { name: /theme select/i })).toHaveAttribute('data-tone', 'warning');
        expect(screen.getByRole('combobox', { name: /theme select/i })).toHaveAttribute('data-ui-state', 'error');
    });

    it('renders composite shell and state patterns', () => {
        render(
            <AppShell header={<div>Header</div>}>
                <FormSection title="General" description="Baseline settings">
                    <div>Body</div>
                </FormSection>
                <DataEmpty title="No settings found" description="Try another keyword." />
            </AppShell>,
        );

        expect(screen.getByText('Header')).toBeInTheDocument();
        expect(screen.getByText('General')).toBeInTheDocument();
        expect(screen.getByText('No settings found')).toBeInTheDocument();
    });
});
