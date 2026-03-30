import { DOM_EVENT } from './constants';

export type CommandPayloadMap = {
    [DOM_EVENT.OPEN_PROJECT_HUB]: undefined;
    [DOM_EVENT.OPEN_CONTEXT_SEARCH]: undefined;
    [DOM_EVENT.OPEN_ENVIRONMENT_SWITCHER]: undefined;
    [DOM_EVENT.CLOSE_ACTIVE_TAB]: undefined;
    [DOM_EVENT.RUN_QUERY_ACTION]: { tabId: string };
    [DOM_EVENT.RUN_EXPLAIN_ACTION]: { tabId: string; analyze: boolean };
    [DOM_EVENT.FORMAT_QUERY_ACTION]: { tabId?: string } | undefined;
    [DOM_EVENT.TOGGLE_BOOKMARK_ACTION]: { tabId?: string } | undefined;
    [DOM_EVENT.NEXT_BOOKMARK_ACTION]: { tabId?: string } | undefined;
    [DOM_EVENT.OPEN_QUERY_COMPARE]: undefined;
    [DOM_EVENT.JUMP_TO_LINE_ACTION]: { tabId: string; line: number };
    [DOM_EVENT.SAVE_TAB_ACTION]: string | undefined;
    [DOM_EVENT.RENAME_TAB]: string;
};

export type CommandName = keyof CommandPayloadMap;

export function emitCommand<K extends CommandName>(
    name: K,
    payload?: CommandPayloadMap[K],
): void {
    window.dispatchEvent(new CustomEvent(name, { detail: payload }));
}

export function onCommand<K extends CommandName>(
    name: K,
    handler: (payload: CommandPayloadMap[K], event: CustomEvent<CommandPayloadMap[K]>) => void,
    options?: AddEventListenerOptions,
): () => void {
    const listener = (event: Event) => {
        const customEvent = event as CustomEvent<CommandPayloadMap[K]>;
        handler(customEvent.detail, customEvent);
    };

    window.addEventListener(name, listener, options);
    return () => window.removeEventListener(name, listener, options);
}
