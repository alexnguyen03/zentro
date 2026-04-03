import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { SettingsView } from './SettingsView';

const { saveMock, addTabMock, toastSuccessMock, toastErrorMock, settingsState, environmentState } = vi.hoisted(() => {
    const save = vi.fn().mockResolvedValue(undefined);
    return {
        saveMock: save,
        addTabMock: vi.fn(),
        toastSuccessMock: vi.fn(),
        toastErrorMock: vi.fn(),
        settingsState: {
            theme: 'light',
            fontSize: 14,
            defaultLimit: 1000,
            toastPlacement: 'bottom-left',
            connectTimeout: 10,
            queryTimeout: 60,
            autoCheckUpdates: true,
            save,
        },
        environmentState: {
            activeEnvironmentKey: 'loc',
        },
    };
});

vi.mock('../../stores/settingsStore', () => ({
    useSettingsStore: Object.assign(
        (selector?: (state: typeof settingsState) => unknown) => {
            if (selector) return selector(settingsState);
            return settingsState;
        },
        { getState: () => settingsState },
    ),
}));

vi.mock('../../stores/editorStore', () => ({
    useEditorStore: () => ({
        addTab: addTabMock,
    }),
}));

vi.mock('../../stores/environmentStore', () => ({
    useEnvironmentStore: (selector?: (state: typeof environmentState) => unknown) => {
        if (selector) return selector(environmentState);
        return environmentState;
    },
}));

vi.mock('./Toast', () => ({
    useToast: () => ({
        toast: {
            success: toastSuccessMock,
            error: toastErrorMock,
        },
    }),
}));

vi.mock('../../lib/profilePackage', () => ({
    applyProfilePackage: vi.fn().mockResolvedValue(undefined),
    buildCurrentProfilePackage: vi.fn(() => ({
        metadata: { name: 'Zentro Profile' },
    })),
    downloadProfilePackage: vi.fn(),
    parseProfilePackage: vi.fn(),
}));

vi.mock('../../features/telemetry/localMetricsStore', () => ({
    buildTelemetryPipelineExportBundle: vi.fn(() => ({})),
    exportTelemetryPipelineBundle: vi.fn(),
}));

vi.mock('../../features/telemetry/consent', () => ({
    getTelemetryConsent: vi.fn(() => ({ optedIn: false })),
    setTelemetryConsent: vi.fn(),
}));

vi.mock('../../../wailsjs/go/models', () => ({
    utils: {
        Preferences: class Preferences {
            constructor(init: Record<string, unknown>) {
                Object.assign(this, init);
            }
        },
    },
}));

describe('SettingsView', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        environmentState.activeEnvironmentKey = 'loc';
    });

    it('filters sections by search query', () => {
        render(<SettingsView tabId="settings-tab" />);

        expect(screen.getByText('Appearance')).toBeInTheDocument();
        expect(screen.getByText('Notifications')).toBeInTheDocument();

        fireEvent.change(screen.getByPlaceholderText('Search settings...'), {
            target: { value: 'notif' },
        });

        expect(screen.getByText('Notifications')).toBeInTheDocument();
        expect(screen.queryByText('Appearance')).not.toBeInTheDocument();
    });

    it('auto-saves when a setting is changed', async () => {
        vi.useFakeTimers();
        try {
            render(<SettingsView tabId="settings-tab" />);

            const themeTrigger = screen.getAllByRole('combobox')[0];
            if (!(themeTrigger instanceof HTMLButtonElement)) {
                throw new Error('Theme selector trigger is missing');
            }
            fireEvent.click(themeTrigger);
            fireEvent.click(screen.getByRole('option', { name: 'Dark Mode' }));

            await act(async () => {
                vi.advanceTimersByTime(600);
            });

            expect(saveMock).toHaveBeenCalledTimes(1);
            const payload = saveMock.mock.calls[0]?.[0] as { theme?: string };
            expect(payload.theme).toBe('dark');
        } finally {
            vi.useRealTimers();
        }
    });

    it('uses compact single-column section styling', () => {
        const { container } = render(<SettingsView tabId="settings-tab" />);
        const section = screen.getByText('Appearance').closest('div');
        expect(section?.className).not.toContain('lg:grid-cols-12');
        expect(container.querySelector('.lg\\:col-span-4')).toBeNull();
        expect(container.querySelector('.lg\\:col-span-8')).toBeNull();
    });

    it('applies write safety level to active environment and updates strong confirm slider', () => {
        const view = render(<SettingsView tabId="settings-tab" />);

        const strongConfirmLabel = screen.getByText('Strong Confirm From Environment');
        const strongConfirmSlider = strongConfirmLabel.parentElement?.querySelector('input[type="range"]');

        if (!(strongConfirmSlider instanceof HTMLInputElement)) {
            throw new Error('Write safety fields are not rendered correctly');
        }

        const getSafetyTrigger = () => {
            const trigger = screen.getAllByRole('combobox').find((element) => (
                /balanced|relaxed|strict/i.test(element.textContent || '')
            ));
            if (!(trigger instanceof HTMLButtonElement)) {
                throw new Error('Write safety trigger is not rendered correctly');
            }
            return trigger;
        };

        expect(getSafetyTrigger()).toHaveTextContent(/balanced/i);
        expect(strongConfirmSlider.value).toBe('0');

        fireEvent.click(getSafetyTrigger());
        fireEvent.click(screen.getByRole('option', { name: 'Relaxed' }));
        expect(getSafetyTrigger()).toHaveTextContent(/relaxed/i);
        expect(toastSuccessMock).toHaveBeenCalledWith('Write safety for Local set to relaxed.');

        environmentState.activeEnvironmentKey = 'pro';
        view.rerender(<SettingsView tabId="settings-tab" />);
        expect(getSafetyTrigger()).toHaveTextContent(/strict/i);

        environmentState.activeEnvironmentKey = 'loc';
        view.rerender(<SettingsView tabId="settings-tab" />);
        expect(getSafetyTrigger()).toHaveTextContent(/relaxed/i);

        fireEvent.click(screen.getByRole('button', { name: 'Set strong confirm threshold to Staging' }));
        expect(strongConfirmSlider.value).toBe('1');
        expect(localStorage.getItem('zentro:execution-policy-strong-confirm-from:v1')).toBe('"sta"');
        expect(toastSuccessMock).toHaveBeenCalledTimes(1);
    });
});
