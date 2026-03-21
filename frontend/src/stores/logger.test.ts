import { create } from 'zustand';
import { describe, expect, it, vi } from 'vitest';
import { withStoreLogger } from './logger';

interface CounterState {
    count: number;
    inc: () => void;
}

describe('withStoreLogger', () => {
    it('logs state transitions', () => {
        const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
        const useCounter = create<CounterState>()(
            withStoreLogger('counterStore', (set) => ({
                count: 0,
                inc: () => set((state) => ({ count: state.count + 1 })),
            }))
        );

        useCounter.getState().inc();
        expect(useCounter.getState().count).toBe(1);
        expect(logSpy).toHaveBeenCalled();
        logSpy.mockRestore();
    });
});

