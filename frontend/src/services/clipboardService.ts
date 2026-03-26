import { ClipboardGetText, ClipboardSetText } from '../../wailsjs/runtime/runtime';

const getBrowserClipboard = () => globalThis.navigator?.clipboard;

export async function setClipboardText(text: string): Promise<void> {
    try {
        await ClipboardSetText(text);
        return;
    } catch {
        // Fallback for browser/dev contexts where Wails runtime is unavailable.
    }

    const browserClipboard = getBrowserClipboard();
    if (!browserClipboard) {
        throw new Error('Clipboard API is unavailable');
    }
    await browserClipboard.writeText(text);
}

export async function getClipboardText(): Promise<string> {
    try {
        return await ClipboardGetText();
    } catch {
        // Fallback for browser/dev contexts where Wails runtime is unavailable.
    }

    const browserClipboard = getBrowserClipboard();
    if (!browserClipboard) {
        throw new Error('Clipboard API is unavailable');
    }
    return browserClipboard.readText();
}
