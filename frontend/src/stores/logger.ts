import type { StateCreator } from 'zustand';
import { appLogger } from '../lib/logger';

function getChangedKeys<T extends object>(before: T, after: T): string[] {
    const keys = new Set<string>([...Object.keys(before), ...Object.keys(after)]);
    return Array.from(keys).filter((key) => (before as any)[key] !== (after as any)[key]);
}

export function withStoreLogger<T extends object>(storeName: string, creator: StateCreator<T, [], []>): StateCreator<T, [], []> {
    return (set, get, api) =>
        creator(
            (partial, replace) => {
                const prev = get();
                try {
                    if (replace === true) {
                        set(partial as any, true);
                    } else {
                        set(partial as any);
                    }
                    const next = get();
                    appLogger.debug('store state changed', {
                        store: storeName,
                        changedKeys: getChangedKeys(prev, next),
                    });
                } catch (error) {
                    appLogger.error('store set failed', {
                        store: storeName,
                        error: error instanceof Error
                            ? { message: error.message, stack: error.stack }
                            : String(error),
                    });
                    throw error;
                }
            },
            get,
            api
        );
}
