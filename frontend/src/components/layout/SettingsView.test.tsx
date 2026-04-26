import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { SettingsView } from './SettingsView';

const { saveMock, addTabMock, toastSuccessMock, toastErrorMock, settingsState, environmentState, projectState, saveProjectMock } = vi.hoisted(() => {
    const save = vi.fn().mockResolvedValue(undefined);
    const saveProject = vi.fn().mockImplementation(async (project: Record<string, unknown>) => project);
    return {
        saveMock: save,
        saveProjectMock: saveProject,
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
        projectState: {
            activeProject: {
                id: 'p1',
                name: 'Project 1',
                git_repo_path: 'C:/repo/demo',
                auto_commit_on_exit: false,
            },
            saveProject,
        } as {
            activeProject: {
                id: string;
                name: string;
                git_repo_path: string;
                auto_commit_on_exit: boolean;
            } | null;
            saveProject: typeof saveProject;
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

vi.mock('../../stores/projectStore', () => ({
    useProjectStore: (selector?: (state: typeof projectState) => unknown) => {
        if (selector) return selector(projectState);
        return projectState;
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
        projectState.activeProject = {
            id: 'p1',
            name: 'Project 1',
            git_repo_path: 'C:/repo/demo',
            auto_commit_on_exit: false,
        };
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

        const getStrongConfirmSlider = () => {
            const slider = screen.getByRole('slider');
            if (!(slider instanceof HTMLElement)) {
                throw new Error('Write safety fields are not rendered correctly');
            }
            return slider;
        };

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
        expect(getStrongConfirmSlider()).toHaveAttribute('aria-valuenow', '0');

        fireEvent.click(getSafetyTrigger());
        fireEvent.click(screen.getByRole('option', { name: 'Relaxed' }));
        expect(getSafetyTrigger()).toHaveTextContent(/relaxed/i);

        environmentState.activeEnvironmentKey = 'pro';
        view.rerender(<SettingsView tabId="settings-tab" />);
        expect(getSafetyTrigger()).toHaveTextContent(/strict/i);

        environmentState.activeEnvironmentKey = 'loc';
        view.rerender(<SettingsView tabId="settings-tab" />);
        expect(getSafetyTrigger()).toHaveTextContent(/relaxed/i);

        fireEvent.click(screen.getByLabelText('Set strong confirm threshold to Staging'));
        expect(getStrongConfirmSlider()).toHaveAttribute('aria-valuenow', '1');
        expect(localStorage.getItem('zentro:execution-policy-strong-confirm-from')).toBe('"sta"');
        expect(toastSuccessMock).not.toHaveBeenCalled();
    });

    it('disables auto-commit toggle when no active project or missing repo path', () => {
        projectState.activeProject = null;
        const first = render(<SettingsView tabId="settings-tab" />);
        expect(screen.getByRole('switch', { name: 'Auto commit on app exit' })).toBeDisabled();
        first.unmount();

        projectState.activeProject = {
            id: 'p2',
            name: 'Project 2',
            git_repo_path: '',
            auto_commit_on_exit: false,
        };
        render(<SettingsView tabId="settings-tab" />);
        expect(screen.getByRole('switch', { name: 'Auto commit on app exit' })).toBeDisabled();
    });

    it('saves active project auto_commit_on_exit when toggled', async () => {
        render(<SettingsView tabId="settings-tab" />);
        const toggle = screen.getByRole('switch', { name: 'Auto commit on app exit' });
        fireEvent.click(toggle);

        await act(async () => Promise.resolve());
        expect(saveProjectMock).toHaveBeenCalledTimes(1);
        expect(saveProjectMock).toHaveBeenCalledWith(expect.objectContaining({
            id: 'p1',
            auto_commit_on_exit: true,
        }));
    });
});
