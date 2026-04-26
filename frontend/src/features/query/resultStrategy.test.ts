import { describe, expect, it } from 'vitest';
import { resolveResultFetchStrategy } from './resultStrategy';

describe('result strategy', () => {
    it('uses server-aware strategy while paging', () => {
        const state = resolveResultFetchStrategy(5000, true, true);
        expect(state.strategy).toBe('server_aware');
    });

    it('uses incremental strategy for large complete result', () => {
        const state = resolveResultFetchStrategy(20000, false, true);
        expect(state.strategy).toBe('incremental_client');
    });
});

