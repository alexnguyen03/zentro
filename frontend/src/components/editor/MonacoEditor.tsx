import React, { useRef, useEffect, useCallback } from 'react';
import Editor, { OnMount, useMonaco } from '@monaco-editor/react';
import { useSchemaStore } from '../../stores/schemaStore';
import { useConnectionStore } from '../../stores/connectionStore';

interface MonacoEditorProps {
    tabId: string;
    value: string;
    onChange: (val: string) => void;
    onRun: () => void;
}

// Track whether the completion provider has been registered (once per app).
let completionProviderDisposed = false;

export const MonacoEditorWrapper: React.FC<MonacoEditorProps> = ({
    tabId,
    value,
    onChange,
    onRun,
}) => {
    const monaco = useMonaco();
    const editorRef = useRef<any>(null);
    const onRunRef = useRef(onRun);
    onRunRef.current = onRun; // keep ref fresh without re-registering keybinding

    const activeProfile = useConnectionStore(s => s.activeProfile);
    const trees = useSchemaStore(s => s.trees);

    // Register SQL completion provider once when monaco is ready
    useEffect(() => {
        if (!monaco || completionProviderDisposed) return;

        const profileKey = activeProfile?.name ?? '';
        // Aggregate all table + column names from all loaded schemas
        const suggestions: { label: string; kind: number }[] = [];
        Object.entries(trees).forEach(([key, schemas]) => {
            if (!key.startsWith(profileKey)) return;
            schemas.forEach(schema => {
                schema.Tables.forEach(t => {
                    suggestions.push({ label: t, kind: monaco.languages.CompletionItemKind.Module });
                });
                schema.Views.forEach(v => {
                    suggestions.push({ label: v, kind: monaco.languages.CompletionItemKind.Field });
                });
            });
        });

        const disposable = monaco.languages.registerCompletionItemProvider('sql', {
            provideCompletionItems: (model, position) => {
                const word = model.getWordUntilPosition(position);
                const range = {
                    startLineNumber: position.lineNumber,
                    endLineNumber: position.lineNumber,
                    startColumn: word.startColumn,
                    endColumn: word.endColumn,
                };
                return {
                    suggestions: suggestions.map(s => ({
                        ...s,
                        insertText: s.label,
                        range,
                    })),
                };
            },
        });

        completionProviderDisposed = false;
        return () => {
            disposable.dispose();
            completionProviderDisposed = true;
        };
    }, [monaco, trees, activeProfile]);

    const handleMount: OnMount = useCallback((editor, monacoInstance) => {
        editorRef.current = editor;

        // Override Ctrl+Enter → run query (prevent Monaco's default suggestion accept)
        editor.addCommand(
            monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.Enter,
            () => onRunRef.current()
        );
    }, []);

    return (
        <Editor
            height="100%"
            defaultLanguage="sql"
            theme="vs-dark"
            value={value}
            onChange={(v) => onChange(v ?? '')}
            onMount={handleMount}
            options={{
                automaticLayout: true,
                minimap: { enabled: false },
                fontSize: 14,
                lineHeight: 21,
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                tabSize: 2,
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
