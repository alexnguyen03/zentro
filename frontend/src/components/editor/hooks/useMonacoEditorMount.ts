import { useCallback, type MutableRefObject } from 'react';
import type { OnMount } from '@monaco-editor/react';

interface UseMonacoEditorMountArgs {
    tabId: string;
    editorRef: MutableRefObject<any>;
    isActiveRef: MutableRefObject<boolean | undefined>;
    onFocusRef: MutableRefObject<(() => void) | undefined>;
    runQueryRef: MutableRefObject<(() => void) | undefined>;
    updateFontSize: (delta: number) => void;
}

export function useMonacoEditorMount({
    tabId,
    editorRef,
    isActiveRef,
    onFocusRef,
    runQueryRef,
    updateFontSize,
}: UseMonacoEditorMountArgs): OnMount {
    return useCallback(
        (editor, monacoInstance) => {
            editorRef.current = editor;

            const domNode = editor.getDomNode();
            if (domNode) {
                domNode.addEventListener(
                    'wheel',
                    (event: WheelEvent) => {
                        if (!event) return;
                        if (event.ctrlKey || event.metaKey) {
                            event.preventDefault();
                            event.stopImmediatePropagation();

                            const currentOptions = editor.getOptions();
                            const currentFontSize = currentOptions.get(
                                monacoInstance.editor.EditorOption.fontSize
                            );

                            if (event.deltaY < 0) {
                                const newSize = Math.min(48, currentFontSize + 1);
                                editor.updateOptions({ fontSize: newSize, lineHeight: newSize * 1.5 });
                                updateFontSize(1);
                            } else {
                                const newSize = Math.max(8, currentFontSize - 1);
                                editor.updateOptions({ fontSize: newSize, lineHeight: newSize * 1.5 });
                                updateFontSize(-1);
                            }
                        }
                    },
                    { passive: false }
                );
            }

            const safeId = tabId.replace(/[^a-zA-Z0-9]/g, '');
            const editorFocusKey = editor.createContextKey<boolean>(`isEditorFocused_${safeId}`, false);

            editor.onDidFocusEditorWidget(() => {
                editorFocusKey.set(true);
                if (onFocusRef.current) {
                    onFocusRef.current();
                }
            });

            editor.onDidBlurEditorWidget(() => {
                editorFocusKey.set(false);
            });

            editor.addAction({
                id: `run-query-${safeId}`,
                label: 'Run Query',
                keybindings: [monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.Enter],
                precondition: `isEditorFocused_${safeId}`,
                run: () => {
                    if (runQueryRef.current) {
                        runQueryRef.current();
                    }
                },
            });

            if (isActiveRef.current) {
                setTimeout(() => {
                    editor.focus();
                }, 10);
            }
        },
        [editorRef, isActiveRef, onFocusRef, runQueryRef, tabId, updateFontSize]
    );
}
