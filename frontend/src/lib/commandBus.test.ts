import { describe, expect, it, vi } from 'vitest';
import { DOM_EVENT } from './constants';
import { emitCommand, onCommand } from './commandBus';

describe('commandBus', () => {
    it('emits and receives typed payload', () => {
        const handler = vi.fn();
        const off = onCommand(DOM_EVENT.RUN_QUERY_ACTION, handler);

        emitCommand(DOM_EVENT.RUN_QUERY_ACTION, { tabId: 'tab-1' });

        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler).toHaveBeenCalledWith({ tabId: 'tab-1' }, expect.any(CustomEvent));

        off();
    });

    it('unsubscribes listeners', () => {
        const handler = vi.fn();
        const off = onCommand(DOM_EVENT.OPEN_QUERY_COMPARE, handler);
        off();

        emitCommand(DOM_EVENT.OPEN_QUERY_COMPARE);
        expect(handler).not.toHaveBeenCalled();
    });
});
