import React, { useRef, useEffect, useCallback } from 'react';
import Editor, { OnMount, useMonaco } from '@monaco-editor/react';
import { useSchemaStore } from '../../stores/schemaStore';
import { useConnectionStore } from '../../stores/connectionStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { registerContextAwareSQLCompletion } from '../../lib/monaco/sqlCompletion';

interface MonacoEditorProps {
    tabId: string;
    value: string;
    onChange: (val: string) => void;
    onRun: (query: string) => void;
    isActive?: boolean;
    onFocus?: () => void;
}

export const MonacoEditorWrapper: React.FC<MonacoEditorProps> = ({
    tabId,
    value,
    onChange,
    onRun,
    isActive,
    onFocus,
}) => {
    const monaco = useMonaco();
    const editorRef = useRef<any>(null);
    const onRunRef = useRef(onRun);
    onRunRef.current = onRun; // keep ref fresh without re-registering keybinding
    const onFocusRef = useRef(onFocus);
    onFocusRef.current = onFocus;
    const isActiveRef = useRef(isActive);
    isActiveRef.current = isActive;

    // Focus editor when it becomes active
    useEffect(() => {
        if (isActive && editorRef.current) {
            editorRef.current.focus();
        }
    }, [isActive]);

    const runQueryRef = useRef<() => void>();

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
            // Find current block separated by empty lines
            const position = editor.getPosition();
            if (position) {
                const currentLine = position.lineNumber;
                const lineCount = model.getLineCount();

                // If currently on an empty line, look up to find the nearest block
                let searchLine = currentLine;
                while (searchLine > 0 && model.getLineContent(searchLine).trim() === '') {
                    searchLine--;
                }

                // If nothing above, look down
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
                        endColumn: model.getLineMaxColumn(endLine)
                    });

                    if (blockText.trim()) {
                        textToRun = blockText;

                        // Visually select the executed block to give feedback
                        editor.setSelection({
                            startLineNumber: startLine,
                            startColumn: 1,
                            endLineNumber: endLine,
                            endColumn: model.getLineMaxColumn(endLine)
                        });
                    }
                }
            }
        }

        // Fallback to full file run if for some reason extracted text is still empty
        if (!textToRun.trim()) {
            textToRun = model.getValue();
        }

        textToRun = textToRun.trim().replace(/;+$/, '');
        if (!textToRun) return;
        onRunRef.current(textToRun);
    }, []);

    runQueryRef.current = runQuery;

    // Listen to global run action from Toolbar
    useEffect(() => {
        const handleGlobalRun = (e: any) => {
            if (e.detail?.tabId === tabId && isActiveRef.current) {
                runQuery();
            }
        };
        window.addEventListener('run-query-action', handleGlobalRun);
        return () => window.removeEventListener('run-query-action', handleGlobalRun);
    }, [tabId, runQuery]);

    const activeProfile = useConnectionStore(s => s.activeProfile);
    const trees = useSchemaStore(s => s.trees);
    const { fontSize, theme } = useSettingsStore();

    // Resolve 'system' theme to actual monaco theme
    const getMonacoTheme = () => {
        if (theme === 'dark') return 'vs-dark';
        if (theme === 'light') return 'vs';
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'vs-dark' : 'vs';
    };

    // Register SQL completion provider once when monaco is ready
    useEffect(() => {
        if (!monaco) return;
        registerContextAwareSQLCompletion(monaco);
    }, [monaco]);


    const handleMount: OnMount = useCallback((editor, monacoInstance) => {
        editorRef.current = editor;

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

        // Use addAction with unique precondition so Ctrl+Enter doesn't leak to other split editors
        editor.addAction({
            id: `run-query-${safeId}`,
            label: 'Run Query',
            keybindings: [monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.Enter],
            precondition: `isEditorFocused_${safeId}`,
            run: () => {
                if (runQueryRef.current) runQueryRef.current();
            }
        });

        if (isActiveRef.current) {
            // Need a tiny timeout because monaco layout might need to settle
            setTimeout(() => {
                editor.focus();
            }, 10);
        }
    }, []);

    return (
        <Editor
            height="100%"
            defaultLanguage="sql"
            theme={getMonacoTheme()}
            value={value}
            onChange={(v) => onChange(v ?? '')}
            onMount={handleMount}
            options={{
                automaticLayout: true,
                minimap: { enabled: false },
                fontSize: fontSize,
                lineHeight: fontSize * 1.5,
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                tabSize: 2,
                wordBasedSuggestions: 'off',
                suggestOnTriggerCharacters: true,
                quickSuggestions: { other: true, comments: false, strings: false },
                scrollbar: {
                    verticalScrollbarSize: 8,
                    horizontalScrollbarSize: 8,
                },
            }}
        />
    );
};
