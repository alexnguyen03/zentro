import React, { useRef, useEffect, useMemo, useCallback } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import { Copy, PlusSquare, ExternalLink } from 'lucide-react';
import { cn } from '../../lib/cn';
import { buildFilterQuery, getQueryShape } from '../../lib/queryBuilder';
import { useToast } from '../layout/Toast';
import { setClipboardText } from '../../services/clipboardService';
import { createResultFilterModelPath, registerResultFilterCompletion } from '../../lib/monaco/resultFilterCompletion';
import { useSettingsStore } from '../../stores/settingsStore';
import { useConnectionStore } from '../../stores/connectionStore';

interface ResultFilterBarProps {
    value: string;
    onChange: (v: string) => void;
    onRun: (currentValue?: string) => void;
    /** Clears the filter and re-runs the original query */
    onClear: () => void;
    /** The base query being wrapped */
    baseQuery?: string;
    /** Appends the generated filter SQL as new lines at the end of the active editor */
    onAppendToQuery?: (fullQuery: string) => void;
    /** Opens the generated filter SQL in a new query tab */
    onOpenInNewTab?: (fullQuery: string) => void;
    /** Result columns used for in-filter SQL suggestions */
    columns?: string[];
    /** Optional table name for model identity */
    tableName?: string;
    /** Optional actions to render on the right side of the bar */
    children?: React.ReactNode;
}

export const ResultFilterBar: React.FC<ResultFilterBarProps> = ({
    value,
    onChange,
    onRun,
    onClear,
    baseQuery,
    onAppendToQuery,
    onOpenInNewTab,
    columns = [],
    tableName,
    children,
}) => {
    const monacoRef = useRef<Parameters<OnMount>[1] | null>(null);
    const completionDisposableRef = useRef<{ dispose: () => void } | null>(null);
    const editorInstanceKey = useRef(`result-filter-${Math.random().toString(36).slice(2)}`);
    const onRunRef = useRef(onRun);
    const onClearRef = useRef(onClear);
    const onChangeRef = useRef(onChange);
    const { toast } = useToast();
    const { theme } = useSettingsStore();
    const driver = useConnectionStore((s) => s.activeProfile?.driver || '');
    const [showTooltip, setShowTooltip] = React.useState(false);
    const tooltipTimeout = useRef<number>();

    useEffect(() => {
        onRunRef.current = onRun;
    }, [onRun]);

    useEffect(() => {
        onClearRef.current = onClear;
    }, [onClear]);

    useEffect(() => {
        onChangeRef.current = onChange;
    }, [onChange]);

    const modelPath = useMemo(() => {
        const suffix = tableName ? tableName.replace(/[^a-zA-Z0-9_-]/g, '_') : 'result';
        return createResultFilterModelPath(`${editorInstanceKey.current}-${suffix}`);
    }, [tableName]);

    const registerCompletion = useCallback(() => {
        const monaco = monacoRef.current;
        if (!monaco) return;
        completionDisposableRef.current?.dispose();
        completionDisposableRef.current = registerResultFilterCompletion({
            monaco,
            columns,
            driver,
        });
    }, [columns, driver]);

    useEffect(() => {
        registerCompletion();
        return () => {
            completionDisposableRef.current?.dispose();
            completionDisposableRef.current = null;
        };
    }, [registerCompletion]);

    const handleMonacoMount: OnMount = useCallback((editor, monaco) => {
        monacoRef.current = monaco;
        registerCompletion();

        editor.addCommand(
            monaco.KeyMod.CtrlCmd | monaco.KeyCode.Space,
            () => {
                void editor.trigger('result-filter', 'editor.action.triggerSuggest', {});
            },
        );
        editor.addCommand(
            monaco.KeyCode.Escape,
            () => {
                onClearRef.current();
            },
            '!suggestWidgetVisible',
        );

        editor.onKeyDown((event) => {
            if (event.keyCode !== monaco.KeyCode.Enter) return;
            const editorDomNode = editor.getDomNode();
            const suggestVisible = Boolean(editorDomNode?.querySelector('.suggest-widget.visible'));
            if (suggestVisible) return;
            event.preventDefault();
            event.stopPropagation();
            const currentValue = editor.getValue();
            const nextValue = currentValue.trim();
            onChangeRef.current(currentValue);
            if (!nextValue) {
                onClearRef.current();
                return;
            }
            onRunRef.current(currentValue);
        });
    }, [registerCompletion]);

    const getMonacoTheme = useCallback(() => {
        if (theme === 'dark') return 'vs-dark';
        if (theme === 'light') return 'vs';
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'vs-dark' : 'vs';
    }, [theme]);

    const iconBtn = cn(
        'flex items-center justify-center p-1 border border-transparent rounded-md',
        'text-text-secondary hover:border-border hover:bg-bg-secondary hover:text-text-primary',
        'transition-colors cursor-pointer shrink-0'
    );

    const renderQueryPreview = (q: string) => {
        const shape = getQueryShape(q);
        const cond = value || '<condition>';

        if (shape === 'bare') {
            return <>
                {q} <span className="text-pink-600 dark:text-pink-400">AS</span> _zentro_filter<br />
                <span className="text-success font-semibold">WHERE</span> {cond}
            </>;
        }

        if (shape === 'has-where') {
            const whereIdx = q.search(/\bwhere\b/i);
            const beforeWhere = q.slice(0, whereIdx).trimEnd();
            const existingCond = q.slice(whereIdx + 5).trim();
            return <>
                {beforeWhere} <span className="text-pink-600 dark:text-pink-400">WHERE</span> ({existingCond})<br />
                <span className="pl-4 inline-block text-pink-600 dark:text-pink-400">AND</span> ({cond})
            </>;
        }

        return <>
            <span className="text-pink-600 dark:text-pink-400">SELECT</span> * <span className="text-pink-600 dark:text-pink-400">FROM</span> (<br />
            <span className="pl-4 inline-block">{q}</span><br />
            ) <span className="text-pink-600 dark:text-pink-400">AS</span> _zentro_filter<br />
            <span className="text-success font-semibold">WHERE</span> {cond}
        </>;
    };

    return (
        <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-border bg-bg-secondary shrink-0 relative">
            <div className="flex items-center flex-3 min-w-0">
                <div
                    className="relative flex items-center border-r pr-2 mr-2"
                    onMouseEnter={() => {
                        tooltipTimeout.current && clearTimeout(tooltipTimeout.current);
                        setShowTooltip(true);
                    }}
                    onMouseLeave={() => {
                        tooltipTimeout.current = setTimeout(() => setShowTooltip(false), 200);
                    }}
                >
                    <span className="text-[11px] uppercase cursor-pointer font-semibold text-text-muted hover:text-text-primary tracking-wide shrink-0 select-none transition-colors">
                        WHERE
                    </span>

                    {showTooltip && baseQuery && (
                        <div className="group absolute top-full left-0 z-panel-overlay mt-2 w-120 overflow-hidden rounded-md border border-border bg-bg-primary shadow-lg animate-in fade-in zoom-in-95 duration-100">
                            <div className="absolute right-2 top-2 z-10 flex flex-col items-center gap-0.5 rounded-md bg-bg-primary/95 p-0.5 opacity-0 pointer-events-none transition-opacity duration-150 group-hover:opacity-100 group-hover:pointer-events-auto">
                                <button
                                    className={iconBtn}
                                    title="Copy query"
                                    onClick={() => {
                                        void setClipboardText(buildFilterQuery(baseQuery, value || '<condition>'))
                                            .then(() => toast.success('Query copied to clipboard'))
                                            .catch(() => toast.error('Failed to copy query'));
                                    }}
                                >
                                    <Copy size={12} />
                                </button>

                                {onAppendToQuery && (
                                    <button
                                        className={cn(iconBtn, 'text-success hover:bg-success/10 hover:border-success/30')}
                                        title="Append to current tab (last line)"
                                        onClick={() => {
                                            onAppendToQuery(buildFilterQuery(baseQuery, value || '<condition>'));
                                            setShowTooltip(false);
                                        }}
                                    >
                                        <PlusSquare size={12} />
                                    </button>
                                )}

                                {onOpenInNewTab && (
                                    <button
                                        className={cn(iconBtn, 'text-text-secondary hover:text-text-primary')}
                                        title="Open in new tab"
                                        onClick={() => {
                                            onOpenInNewTab(buildFilterQuery(baseQuery, value || '<condition>'));
                                            setShowTooltip(false);
                                        }}
                                    >
                                        <ExternalLink size={12} />
                                    </button>
                                )}
                            </div>
                            <div className="p-3 pr-12 text-[11px] font-mono whitespace-pre-wrap max-h-[250px] overflow-y-auto text-text-secondary">
                                {renderQueryPreview(baseQuery.replace(/;\s*$/, '').trim())}
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex-1 min-w-[50px] h-[22px] relative zentro-filter-monaco">
                    <Editor
                        path={modelPath}
                        theme={getMonacoTheme()}
                        defaultLanguage="sql"
                        value={value}
                        onMount={handleMonacoMount}
                        onChange={(next) => onChange(next ?? '')}
                        options={{
                            automaticLayout: true,
                            minimap: { enabled: false },
                            glyphMargin: false,
                            lineNumbers: 'off',
                            folding: false,
                            lineDecorationsWidth: 0,
                            lineNumbersMinChars: 0,
                            renderLineHighlight: 'none',
                            overviewRulerLanes: 0,
                            overviewRulerBorder: false,
                            hideCursorInOverviewRuler: true,
                            wordWrap: 'off',
                            scrollBeyondLastLine: false,
                            contextmenu: true,
                            fontSize: 12,
                            lineHeight: 20,
                            fontFamily: 'var(--font-mono, monospace)',
                            quickSuggestions: { other: true, comments: false, strings: false },
                            wordBasedSuggestions: 'off',
                            suggestOnTriggerCharacters: true,
                            acceptSuggestionOnEnter: 'on',
                            tabCompletion: 'on',
                            scrollbar: {
                                vertical: 'hidden',
                                verticalScrollbarSize: 0,
                                horizontal: 'auto',
                                horizontalScrollbarSize: 6,
                                handleMouseWheel: true,
                            },
                            padding: { top: 0, bottom: 0 },
                        }}
                    />
                    {!value && (
                        <span className="pointer-events-none absolute left-1 top-1/2 -translate-y-1/2 text-[12px] text-text-muted font-mono select-none">
                            Filter rows... e.g. id &gt; 100 AND name LIKE '%foo%'
                        </span>
                    )}
                </div>
            </div>
            {children && (
                <div className="flex items-center flex-2 justify-end min-w-0 border-l border-border pl-2 gap-1 overflow-x-auto">
                    {children}
                </div>
            )}
        </div>
    );
};
