import { describe, expect, it } from 'vitest';
import {
    listQueryCommandContributions,
    listResultActionContributions,
    registerQueryCommandContribution,
    registerResultActionContribution,
} from './contributionRegistry';

describe('query contribution registry', () => {
    it('registers and unregisters query command contribution', () => {
        const unregister = registerQueryCommandContribution({
            id: 'test.command',
            title: 'Test Command',
            run: () => {},
        });
        expect(listQueryCommandContributions().some((item) => item.id === 'test.command')).toBe(true);
        unregister();
        expect(listQueryCommandContributions().some((item) => item.id === 'test.command')).toBe(false);
    });

    it('registers and unregisters result action contribution', () => {
        const unregister = registerResultActionContribution({
            id: 'test.result.action',
            title: 'Test Result Action',
            run: () => {},
        });
        expect(listResultActionContributions().some((item) => item.id === 'test.result.action')).toBe(true);
        unregister();
        expect(listResultActionContributions().some((item) => item.id === 'test.result.action')).toBe(false);
    });
});

