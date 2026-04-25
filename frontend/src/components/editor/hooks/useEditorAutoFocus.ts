import { useEffect, type MutableRefObject } from 'react';

export function useEditorAutoFocus(
    isActive: boolean | undefined,
    editorRef: MutableRefObject<any>
) {
    useEffect(() => {
        if (isActive && editorRef.current) {
            editorRef.current.focus();
        }
    }, [isActive, editorRef]);
}
