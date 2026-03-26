import { beforeEach, describe, expect, it, vi } from 'vitest';

const runtimeMock = vi.hoisted(() => ({
    ClipboardGetText: vi.fn(),
    ClipboardSetText: vi.fn(),
}));

vi.mock('../../wailsjs/runtime/runtime', () => runtimeMock);

import { getClipboardText, setClipboardText } from './clipboardService';

describe('clipboardService', () => {
    beforeEach(() => {
        runtimeMock.ClipboardGetText.mockReset();
        runtimeMock.ClipboardSetText.mockReset();
        Object.defineProperty(globalThis.navigator, 'clipboard', {
            configurable: true,
            value: {
                writeText: vi.fn().mockResolvedValue(undefined),
                readText: vi.fn().mockResolvedValue('browser-text'),
            },
        });
    });

    it('uses Wails clipboard writer when available', async () => {
        runtimeMock.ClipboardSetText.mockResolvedValue(true);

        await setClipboardText('hello');

        expect(runtimeMock.ClipboardSetText).toHaveBeenCalledWith('hello');
        expect(globalThis.navigator.clipboard.writeText).not.toHaveBeenCalled();
    });

    it('falls back to browser clipboard writer when Wails runtime fails', async () => {
        runtimeMock.ClipboardSetText.mockRejectedValue(new Error('runtime unavailable'));

        await setClipboardText('fallback');

        expect(globalThis.navigator.clipboard.writeText).toHaveBeenCalledWith('fallback');
    });

    it('uses Wails clipboard reader when available', async () => {
        runtimeMock.ClipboardGetText.mockResolvedValue('wails-text');

        const value = await getClipboardText();

        expect(value).toBe('wails-text');
        expect(globalThis.navigator.clipboard.readText).not.toHaveBeenCalled();
    });

    it('falls back to browser clipboard reader when Wails runtime fails', async () => {
        runtimeMock.ClipboardGetText.mockRejectedValue(new Error('runtime unavailable'));

        const value = await getClipboardText();

        expect(value).toBe('browser-text');
        expect(globalThis.navigator.clipboard.readText).toHaveBeenCalledTimes(1);
    });
});
