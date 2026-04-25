import { RefObject, useEffect } from 'react';

export function useResultFilterEscapeClear(inputRef: RefObject<HTMLInputElement>, onClear: () => void) {
    useEffect(() => {
        const element = inputRef.current;
        if (!element) {
            return;
        }

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClear();
                event.stopPropagation();
            }
        };

        element.addEventListener('keydown', onKeyDown);
        return () => element.removeEventListener('keydown', onKeyDown);
    }, [inputRef, onClear]);
}
