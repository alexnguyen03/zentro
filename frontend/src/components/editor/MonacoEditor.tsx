import React, { useRef, useEffect, useCallback } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import { useSchemaStore } from '../../stores/schemaStore';
import { useConnectionStore } from '../../stores/connectionStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useBookmarkStore } from '../../stores/bookmarkStore';
import { registerContextAwareSQLCompletion } from '../../lib/monaco/sqlCompletion';
import { EditorToolbar } from './EditorToolbar';
import { DOM_EVENT } from '../../lib/constants';
import { onCommand } from '../../lib/commandBus';
import { FormatSQL } from '../../services/queryService';

interface MonacoEditorProps {
    tabId: string;
    value: string;
    onChange: (val: string) => void;
    onRun: (query: string) => void;
    onExplain?: (query: string, analyze: boolean) => void;
    isActive?: boolean;
    onFocus?: () => void;
    readOnly?: boolean;
}

export const MonacoEditorWrapper: React.FC<MonacoEditorProps> = ({
    tabId,
    value,
    onChange,
    onRun,
    onExplain,
    isActive,
    onFocus,
    readOnly,
}) => {
    const ULTRA_COMPACT_GUTTER = {
        lineNumbersMinChars: 1,
        lineDecorationsWidth: 16,
    } as const;

    const editorRef = useRef<any>(null);
    const onRunRef = useRef(onRun);
    onRunRef.current = onRun; // keep ref fresh without re-registering keybinding
    const onExplainRef = useRef(onExplain);
    onExplainRef.current = onExplain;
    const onFocusRef = useRef(onFocus);
    onFocusRef.current = onFocus;
    const isActiveRef = useRef(isActive);
    isActiveRef.current = isActive;
    const readOnlyRef = useRef(readOnly);
    readOnlyRef.current = readOnly;
    const decorationRef = useRef<string[]>([]);

    // Focus editor when it becomes active
    useEffect(() => {
        if (isActive && editorRef.current) {
            editorRef.current.focus();
        }
    }, [isActive]);

    const extractRunnableQuery = useCallback(() => {
        if (!editorRef.current) return;
        const editor = editorRef.current;
        const selection = editor.getSelection();
        const model = editor.getModel();
        if (!model) return;

        if (selection && !selection.isEmpty()) {
            return model.getValueInRange(selection).trim().replace(/;+$/, '');
        }

        const position = editor.getPosition();
        if (!position) return '';

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
            if (searchLine > lineCount) return '';
        }

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
        }).trim().replace(/;+$/, '');

        return blockText;
    }, []);

    const runQueryRef = useRef<() => void>();
    const runQuery = useCallback(() => {
        const query = extractRunnableQuery();
        if (!query) return;
        onRunRef.current(query);
    }, [extractRunnableQuery]);
    runQueryRef.current = runQuery;

    // Listen to global run action from Toolbar
    useEffect(() => {
        const off = onCommand(DOM_EVENT.RUN_QUERY_ACTION, (detail) => {
            if (detail?.tabId === tabId && isActiveRef.current) {
                runQuery();
            }
        });
        return off;
    }, [tabId, runQuery]);

    useEffect(() => {
        const off = onCommand(DOM_EVENT.RUN_EXPLAIN_ACTION, (detail) => {
            if (detail?.tabId !== tabId || !isActiveRef.current || !onExplainRef.current) return;
            const query = extractRunnableQuery();
            if (!query) return;
            onExplainRef.current(query, Boolean(detail?.analyze));
        });
        return off;
    }, [extractRunnableQuery, tabId]);

    const activeProfile = useConnectionStore(s => s.activeProfile);
    const trees = useSchemaStore(s => s.trees);
    const { fontSize, theme, updateFontSize } = useSettingsStore();
    const { byTab, loadBookmarks, toggleLine, nextLine } = useBookmarkStore();
    const bookmarks = byTab[tabId] || [];
    const toggleLineRef = useRef(toggleLine);
    toggleLineRef.current = toggleLine;
    const activeProfileNameRef = useRef(activeProfile?.name);
    activeProfileNameRef.current = activeProfile?.name;

    const applyBookmarkDecorations = useCallback(() => {
        const editor = editorRef.current;
        const monaco = (window as any).monaco;
        if (!editor || !monaco) return;

        const nextDecorations = bookmarks.map((bookmark) => ({
            range: new monaco.Range(bookmark.line, 1, bookmark.line, 1),
            options: {
                isWholeLine: true,
                glyphMarginClassName: 'zentro-bookmark-glyph',
                glyphMarginHoverMessage: { value: `Bookmark line ${bookmark.line}\nRight-click line number to toggle.` },
                lineDecorationsClassName: 'zentro-bookmark-line',
            }
        }));
        decorationRef.current = editor.deltaDecorations(decorationRef.current, nextDecorations);
    }, [bookmarks]);

    useEffect(() => {
        if (!activeProfile?.name) return;
        loadBookmarks(activeProfile.name, tabId).catch((err) => console.error('load bookmarks failed', err));
    }, [activeProfile?.name, tabId, loadBookmarks]);

    useEffect(() => {
        applyBookmarkDecorations();
    }, [applyBookmarkDecorations]);

    // Resolve 'system' theme to actual monaco theme
    const getMonacoTheme = () => {
        if (theme === 'dark') return 'vs-dark';
        if (theme === 'light') return 'vs';
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'vs-dark' : 'vs';
    };

    const handleMount: OnMount = useCallback((editor, monacoInstance) => {
        editorRef.current = editor;

        // Register SQL completion provider
        registerContextAwareSQLCompletion(monacoInstance);

        // Add wheel handler for Zoom (Ctrl + Wheel) using native DOM event
        // because Monaco's abstraction sometimes fails to capture in specific environments
        const domNode = editor.getDomNode();
        if (domNode) {
            domNode.addEventListener('wheel', (e: WheelEvent) => {
                if (!e) return;
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    e.stopImmediatePropagation();

                    const currentOptions = editor.getOptions();
                    const currentFontSize = currentOptions.get(monacoInstance.editor.EditorOption.fontSize);

                    if (e.deltaY < 0) {
                        const newSize = Math.min(48, currentFontSize + 1);
                        editor.updateOptions({ fontSize: newSize, lineHeight: newSize * 1.5 });
                        updateFontSize(1);
                    } else {
                        const newSize = Math.max(8, currentFontSize - 1);
                        editor.updateOptions({ fontSize: newSize, lineHeight: newSize * 1.5 });
                        updateFontSize(-1);
                    }
                }
            }, { passive: false });
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

        // Bind run query directly on this editor instance for reliable Ctrl/Cmd+Enter behavior.
        editor.addCommand(
            monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.Enter,
            () => {
                if (runQueryRef.current) runQueryRef.current();
            }
        );

        editor.onMouseDown((e: any) => {
            const isRightClick = Boolean(e?.event?.rightButton) || e?.event?.browserEvent?.button === 2;
            if (!isRightClick) return;
            if (readOnlyRef.current) return;
            if (!isActiveRef.current) return;

            const targetType = e?.target?.type;
            const mt = monacoInstance.editor.MouseTargetType;
            const inBookmarkGutter =
                targetType === mt.GUTTER_LINE_NUMBERS ||
                targetType === mt.GUTTER_GLYPH_MARGIN;
            if (!inBookmarkGutter) return;

            const line = Number(e?.target?.position?.lineNumber || 0);
            const connectionName = activeProfileNameRef.current;
            if (!connectionName || line <= 0) return;

            toggleLineRef.current(connectionName, tabId, line).catch((err: unknown) => {
                console.error('toggle bookmark by gutter failed', err);
            });
        });

        if (isActiveRef.current) {
            // Need a tiny timeout because monaco layout might need to settle
            setTimeout(() => {
                editor.focus();
            }, 10);
        }

        // If bookmarks were already hydrated before Monaco mounted, render them now.
        applyBookmarkDecorations();
    }, [applyBookmarkDecorations, tabId, updateFontSize]);

    useEffect(() => {
        const handleFormat = async (detail?: { tabId?: string }) => {
            if (detail?.tabId && detail?.tabId !== tabId) return;
            if (!isActiveRef.current || !editorRef.current) return;
            const query = extractRunnableQuery() || editorRef.current.getModel()?.getValue() || '';
            if (!query.trim()) return;
            try {
                const dialect = activeProfile?.driver || '';
                const formatted = await FormatSQL(query, dialect);
                const model = editorRef.current.getModel();
                if (!model) return;
                model.pushEditOperations([], [{
                    range: model.getFullModelRange(),
                    text: formatted
                }], () => null);
                onChange(formatted);
            } catch (err) {
                console.error('format failed', err);
            }
        };

        const handleToggleBookmark = async (detail?: { tabId?: string }) => {
            if (detail?.tabId && detail?.tabId !== tabId) return;
            if (!isActiveRef.current || !editorRef.current || !activeProfile?.name) return;
            const line = editorRef.current.getPosition()?.lineNumber;
            if (!line) return;
            await toggleLine(activeProfile.name, tabId, line);
        };

        const handleNextBookmark = (detail?: { tabId?: string }) => {
            if (detail?.tabId && detail?.tabId !== tabId) return;
            if (!isActiveRef.current || !editorRef.current) return;
            const currentLine = editorRef.current.getPosition()?.lineNumber || 0;
            const target = nextLine(tabId, currentLine);
            if (!target) return;
            editorRef.current.revealLineInCenter(target);
            editorRef.current.setPosition({ lineNumber: target, column: 1 });
            editorRef.current.focus();
        };

        const handleJumpLine = (detail: { tabId: string; line: number }) => {
            if (detail?.tabId !== tabId) return;
            const line = Number(detail?.line || 0);
            if (!line || !editorRef.current) return;
            editorRef.current.revealLineInCenter(line);
            editorRef.current.setPosition({ lineNumber: line, column: 1 });
            editorRef.current.focus();
        };

        const offFormat = onCommand(DOM_EVENT.FORMAT_QUERY_ACTION, (detail) => {
            void handleFormat(detail);
        });
        const offToggle = onCommand(DOM_EVENT.TOGGLE_BOOKMARK_ACTION, (detail) => {
            void handleToggleBookmark(detail);
        });
        const offNext = onCommand(DOM_EVENT.NEXT_BOOKMARK_ACTION, handleNextBookmark);
        const offJump = onCommand(DOM_EVENT.JUMP_TO_LINE_ACTION, handleJumpLine);

        return () => {
            offFormat();
            offToggle();
            offNext();
            offJump();
        };
    }, [activeProfile?.driver, activeProfile?.name, extractRunnableQuery, nextLine, onChange, tabId, toggleLine]);

    return (
        <div
            className="zentro-sql-editor flex flex-col h-full overflow-hidden"
            style={
                {
                    '--zentro-editor-font-size': `${fontSize}px`,
                    '--zentro-editor-line-height': `${fontSize * 1.5}px`,
                } as React.CSSProperties
            }
        >
            <div className="flex-1 min-h-0">
                <Editor
                    height="100%"
                    defaultLanguage="sql"
                    theme={getMonacoTheme()}
                    value={value}
                    onChange={(v) => {
                        if (!readOnly) {
                            onChange(v ?? '');
                        }
                    }}
                    onMount={handleMount}
                    options={{
                        automaticLayout: true,
                        minimap: { enabled: false },
                        glyphMargin: true,
                        lineNumbersMinChars: ULTRA_COMPACT_GUTTER.lineNumbersMinChars,
                        lineDecorationsWidth: ULTRA_COMPACT_GUTTER.lineDecorationsWidth,
                        fontSize: fontSize,
                        lineHeight: fontSize * 1.5,
                        scrollBeyondLastLine: false,
                        wordWrap: 'on',
                        tabSize: 2,
                        wordBasedSuggestions: 'off',
                        suggestOnTriggerCharacters: true,
                        quickSuggestions: { other: true, comments: false, strings: false },
                        readOnly: Boolean(readOnly),
                        scrollbar: {
                            verticalScrollbarSize: 8,
                            horizontalScrollbarSize: 8,
                        },
                    }}
                />
            </div>
            <EditorToolbar isActive={isActive} tabId={tabId} readOnly={readOnly} />
        </div>
    );
};

