import { describe, expect, it } from 'vitest';
import { classifyQueryFailure } from './runtime';

describe('classifyQueryFailure', () => {
    it('classifies cancellation and timeout', () => {
        expect(classifyQueryFailure('query cancelled by user')).toBe('cancelled');
        expect(classifyQueryFailure('context deadline exceeded timeout')).toBe('timeout');
    });

    it('classifies known errors', () => {
        expect(classifyQueryFailure('permission denied')).toBe('permission');
        expect(classifyQueryFailure('syntax error at or near')).toBe('syntax');
        expect(classifyQueryFailure('network error socket closed')).toBe('network');
    });
});

