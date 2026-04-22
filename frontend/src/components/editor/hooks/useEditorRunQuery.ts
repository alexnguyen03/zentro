import { useCallback, useRef, type MutableRefObject } from 'react';

interface UseEditorRunQueryArgs {
    editorRef: MutableRefObject<any>;
    onRun: (query: string) => void;
}

export function useEditorRunQuery({ editorRef, onRun }: UseEditorRunQueryArgs) {
    const onRunRef = useRef(onRun);
    onRunRef.current = onRun;

    const runQuery = useCallback(() => {
        if (!editorRef.current) return;

        const editor = editorRef.current;
        const selection = editor.getSelection();
        const model = editor.getModel();
        if (!model) return;

        let textToRun = '';
        if (selection && !selection.isEmpty()) {
            textToRun = model.getValueInRange(selection);
        } else {
            const position = editor.getPosition();
            if (position) {
                const currentLine = position.lineNumber;
                const lineCount = model.getLineCount();

                let searchLine = currentLine;
                while (searchLine > 0 && model.getLineContent(searchLine).trim() === '') {
                    searchLine--;
                }

                if (searchLine === 0) {
                    searchLine = currentLine;
                    while (searchLine <= lineCount && model.getLineContent(searchLine).trim() === '') {
                        searchLine++;
                    }
                    if (searchLine > lineCount) searchLine = 0;
                }

                if (searchLine > 0) {
                    let startLine = searchLine;
                    while (startLine > 1) {
                        if (model.getLineContent(startLine - 1).trim() === '') {
                            break;
                        }
                        startLine--;
                    }

                    let endLine = searchLine;
                    while (endLine < lineCount) {
                        if (model.getLineContent(endLine + 1).trim() === '') {
                            break;
                        }
                        endLine++;
                    }

                    const blockText = model.getValueInRange({
                        startLineNumber: startLine,
                        startColumn: 1,
                        endLineNumber: endLine,
                        endColumn: model.getLineMaxColumn(endLine),
                    });

                    if (blockText.trim()) {
                        textToRun = blockText;
                        editor.setSelection({
                            startLineNumber: startLine,
                            startColumn: 1,
                            endLineNumber: endLine,
                            endColumn: model.getLineMaxColumn(endLine),
                        });
                    }
                }
            }
        }

        if (!textToRun.trim()) {
            textToRun = model.getValue();
        }

        textToRun = textToRun.trim().replace(/;+$/, '');
        if (!textToRun) return;
        onRunRef.current(textToRun);
    }, [editorRef]);

    return runQuery;
}
