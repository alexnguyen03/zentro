import { describe, expect, it } from 'vitest';
import {
    listByCapability,
    listPluginContributions,
    registerPluginContribution,
    resolvePluginCommands,
    validateManifest,
} from './registry';

describe('plugin registry', () => {
    it('validates manifest', () => {
        const invalid = validateManifest({
            id: '',
            version: '',
            minAppVersion: '',
            capabilities: [],
        });
        expect(invalid.valid).toBe(false);

        const valid = validateManifest({
            id: 'sample',
            version: '1.0.0',
            minAppVersion: '0.2.0',
            capabilities: ['ui.commands'],
        });
        expect(valid.valid).toBe(true);
    });

    it('registers and resolves commands by capability', () => {
        const dispose = registerPluginContribution({
            manifest: {
                id: 'sample.plugin',
                version: '1.0.0',
                minAppVersion: '0.2.0',
                capabilities: ['ui.commands'],
            },
            commands: [
                {
                    id: 'ext.sample.run',
                    title: 'Sample Run',
                    category: 'App',
                    defaultBinding: 'Ctrl+Shift+Y',
                    handlerKey: 'sample.run',
                },
            ],
        });

        expect(listPluginContributions().length).toBeGreaterThan(0);
        expect(listByCapability('ui.commands')).toHaveLength(1);

        const resolved = resolvePluginCommands(() => () => {});
        expect(resolved).toHaveLength(1);
        expect(resolved[0].entry.label).toBe('Sample Run');
        dispose();
    });
});

