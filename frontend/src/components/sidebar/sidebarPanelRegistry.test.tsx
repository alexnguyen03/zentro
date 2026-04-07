import React from 'react';
import { describe, it, expect } from 'vitest';
import { Circle } from 'lucide-react';
import { getSidebarPanels, registerSidebarPanel, unregisterSidebarPanel } from './sidebarPanelRegistry';

function cleanupTestPanels() {
    [...getSidebarPanels('primary'), ...getSidebarPanels('secondary')]
        .filter((panel) => panel.id.startsWith('test.sidebar.'))
        .forEach((panel) => unregisterSidebarPanel(panel.side, panel.id));
}

describe('sidebarPanelRegistry', () => {
    it('registers panels by side and returns sorted by order', () => {
        cleanupTestPanels();

        registerSidebarPanel({
            id: 'test.sidebar.primary.b',
            side: 'primary',
            label: 'B',
            icon: Circle,
            order: 20,
            render: () => <div>B</div>,
        });
        registerSidebarPanel({
            id: 'test.sidebar.primary.a',
            side: 'primary',
            label: 'A',
            icon: Circle,
            order: 10,
            render: () => <div>A</div>,
        });
        registerSidebarPanel({
            id: 'test.sidebar.secondary.a',
            side: 'secondary',
            label: 'Secondary',
            icon: Circle,
            order: 10,
            render: () => <div>Secondary</div>,
        });

        const primary = getSidebarPanels('primary').filter((panel) => panel.id.startsWith('test.sidebar.primary.'));
        const secondary = getSidebarPanels('secondary').filter((panel) => panel.id.startsWith('test.sidebar.secondary.'));

        expect(primary.map((panel) => panel.id)).toEqual([
            'test.sidebar.primary.a',
            'test.sidebar.primary.b',
        ]);
        expect(secondary.map((panel) => panel.id)).toEqual(['test.sidebar.secondary.a']);

        cleanupTestPanels();
    });

    it('deduplicates same id unless replace is true', () => {
        cleanupTestPanels();

        registerSidebarPanel({
            id: 'test.sidebar.primary.replace',
            side: 'primary',
            label: 'Old',
            icon: Circle,
            order: 10,
            render: () => <div>Old</div>,
        });
        registerSidebarPanel({
            id: 'test.sidebar.primary.replace',
            side: 'primary',
            label: 'Ignored',
            icon: Circle,
            order: 99,
            render: () => <div>Ignored</div>,
        });

        let panel = getSidebarPanels('primary').find((item) => item.id === 'test.sidebar.primary.replace');
        expect(panel?.label).toBe('Old');
        expect(panel?.order).toBe(10);

        registerSidebarPanel({
            id: 'test.sidebar.primary.replace',
            side: 'primary',
            label: 'New',
            icon: Circle,
            order: 30,
            render: () => <div>New</div>,
        }, { replace: true });

        panel = getSidebarPanels('primary').find((item) => item.id === 'test.sidebar.primary.replace');
        expect(panel?.label).toBe('New');
        expect(panel?.order).toBe(30);

        cleanupTestPanels();
    });
});
