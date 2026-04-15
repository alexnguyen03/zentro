import React, { useRef, useEffect, useMemo, useCallback } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import { ArrowLeftRight, Copy, ExternalLink, Plus, PlusSquare, X } from 'lucide-react';
import { cn } from '../../lib/cn';
import { buildFilterOrderQuery } from '../../lib/queryBuilder';
import { OrderDirection, OrderTerm, parseOrderByTerms, serializeOrderByTerms } from '../../lib/orderByBuilder';
import { extractSelectAliases, extractTableAliases } from '../../lib/sqlAliases';
import { useToast } from '../layout/Toast';
import { setClipboardText } from '../../services/clipboardService';
import { createResultFilterModelPath, registerResultFilterCompletion } from '../../lib/monaco/resultFilterCompletion';
import { useSettingsStore } from '../../stores/settingsStore';
import { useConnectionStore } from '../../stores/connectionStore';
import { Badge, Button, Input, Popover, PopoverContent, PopoverTrigger, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui';

interface ResultFilterBarProps {
    value: string;
    onChange: (v: string) => void;
    orderValue?: string;
    onOrderChange?: (v: string) => void;
    onRun: (currentValue?: string, currentOrderBy?: string) => void;
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
    /** Hide SQL filter editor and keep only actions area */
    showFilterInput?: boolean;
    /** Optional actions to render on the right side of the bar */
    children?: React.ReactNode;
}

export const ResultFilterBar: React.FC<ResultFilterBarProps> = ({
    value,
    onChange,
    orderValue = '',
    onOrderChange,
    onRun,
    onClear,
    baseQuery,
    onAppendToQuery,
    onOpenInNewTab,
    columns = [],
    tableName,
    showFilterInput = true,
    children,
}) => {
    const normalizeFilterInput = useCallback((raw: string) => raw.replace(/[\r\n]+/g, ' '), []);
    const monacoRef = useRef<Parameters<OnMount>[1] | null>(null);
    const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
    const completionDisposableRef = useRef<{ dispose: () => void } | null>(null);
    const editorInstanceKey = useRef(`result-filter-${Math.random().toString(36).slice(2)}`);
    const focusContextKey = useRef(`isResultFilterFocused_${Math.random().toString(36).slice(2)}`);
    const onRunRef = useRef(onRun);
    const onClearRef = useRef(onClear);
    const onChangeRef = useRef(onChange);
    const onOrderChangeRef = useRef(onOrderChange);
    const valueRef = useRef(value);
    const orderValueRef = useRef(orderValue);
    const { toast } = useToast();
    const { theme } = useSettingsStore();
    const driver = useConnectionStore((s) => s.activeProfile?.driver || '');
    const [showTooltip, setShowTooltip] = React.useState(false);
    const [orderTerms, setOrderTerms] = React.useState<OrderTerm[]>([]);
    const [orderInputMode, setOrderInputMode] = React.useState<'chips' | 'text'>('chips');
    const [orderBuilderOpen, setOrderBuilderOpen] = React.useState(false);
    const [editingOrderIndex, setEditingOrderIndex] = React.useState<number | null>(null);
    const [selectedOrderField, setSelectedOrderField] = React.useState<string>('');
    const [selectedOrderDir, setSelectedOrderDir] = React.useState<OrderDirection>('ASC');
    const tooltipTimeout = useRef<number>();
    const completionColumns = useMemo(() => {
        const selectAliases = baseQuery ? extractSelectAliases(baseQuery) : [];
        const tableAliases = baseQuery ? extractTableAliases(baseQuery) : [];
        const qualifiedColumns = tableAliases.flatMap((tableAlias) => (
            columns.map((column) => `${tableAlias}.${column}`)
        ));
        return Array.from(
            new Set([...columns, ...selectAliases, ...qualifiedColumns].filter((column) => column && column.trim().length > 0)),
        );
    }, [baseQuery, columns]);

    useEffect(() => {
        onRunRef.current = onRun;
    }, [onRun]);

    useEffect(() => () => {
        if (tooltipTimeout.current) {
            window.clearTimeout(tooltipTimeout.current);
            tooltipTimeout.current = undefined;
        }
    }, []);

    // Dispose Monaco editor and model on unmount to prevent memory accumulation.
    // ResultFilterBar is remounted on every lastExecutedQuery change (via key prop),
    // so without this, Monaco accrues a new model in the global registry each time.
    useEffect(() => {
        return () => {
            completionDisposableRef.current?.dispose();
            completionDisposableRef.current = null;
            const monaco = monacoRef.current;
            if (monaco) {
                try {
                    const uri = monaco.Uri.parse(modelPath);
                    monaco.editor.getModel(uri)?.dispose();
                } catch {
                    // ignore — model may already be gone
                }
            }
            editorRef.current?.dispose();
            editorRef.current = null;
            monacoRef.current = null;
        };
    // modelPath is stable per component instance (depends only on tableName which
    // doesn't change during the lifetime of a keyed ResultFilterBar mount)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        onClearRef.current = onClear;
    }, [onClear]);

    useEffect(() => {
        onChangeRef.current = onChange;
    }, [onChange]);

    useEffect(() => {
        valueRef.current = value;
    }, [value]);

    useEffect(() => {
        onOrderChangeRef.current = onOrderChange;
    }, [onOrderChange]);

    useEffect(() => {
        orderValueRef.current = orderValue;
    }, [orderValue]);

    useEffect(() => {
        const parsed = parseOrderByTerms(orderValue, completionColumns);
        setOrderTerms(parsed.terms);
        if (parsed.isCustom && orderValue.trim()) {
            setOrderInputMode('text');
        } else if (!orderValue.trim()) {
            setOrderInputMode('chips');
        }
    }, [completionColumns, orderValue]);

    const runNow = useCallback((nextFilterRaw: string, nextOrderRaw: string) => {
        const nextFilter = nextFilterRaw.trim();
        const nextOrder = nextOrderRaw.trim();
        if (!nextFilter && !nextOrder) {
            onClearRef.current();
            return;
        }
        onRunRef.current(nextFilterRaw, nextOrderRaw);
    }, []);

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
            columns: completionColumns,
            driver,
        });
    }, [completionColumns, driver]);

    useEffect(() => {
        registerCompletion();
        return () => {
            completionDisposableRef.current?.dispose();
            completionDisposableRef.current = null;
        };
    }, [registerCompletion]);

    const handleMonacoMount: OnMount = useCallback((editor, monaco) => {
        editorRef.current = editor;
        monacoRef.current = monaco;
        registerCompletion();
        const filterEditorFocusContext = editor.createContextKey<boolean>(focusContextKey.current, false);

        editor.onDidFocusEditorWidget(() => {
            filterEditorFocusContext.set(true);
        });

        editor.onDidBlurEditorWidget(() => {
            filterEditorFocusContext.set(false);
        });

        editor.onDidDispose(() => {
            filterEditorFocusContext.set(false);
        });

        editor.addCommand(
            monaco.KeyMod.CtrlCmd | monaco.KeyCode.Space,
            () => {
                void editor.trigger('result-filter', 'editor.action.triggerSuggest', {});
            },
            focusContextKey.current,
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
            if (event.ctrlKey || event.metaKey || event.altKey) {
                return;
            }
            const editorDomNode = editor.getDomNode();
            const suggestVisible = Boolean(editorDomNode?.querySelector('.suggest-widget.visible'));
            if (suggestVisible) return;
            event.preventDefault();
            event.stopPropagation();
            const currentValue = normalizeFilterInput(editor.getValue());
            const nextValue = currentValue.trim();
            onChangeRef.current(currentValue);
            const nextOrder = orderValueRef.current.trim();
            if (!nextValue && !nextOrder) {
                onClearRef.current();
                return;
            }
            runNow(currentValue, orderValueRef.current);
        });
    }, [normalizeFilterInput, registerCompletion, runNow]);

    const getMonacoTheme = useCallback(() => {
        if (theme === 'dark') return 'vs-dark';
        if (theme === 'light') return 'vs';
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'vs-dark' : 'vs';
    }, [theme]);

    const iconBtn = cn(
        'flex items-center justify-center p-1 border border-transparent rounded-sm',
        'text-muted-foreground hover:border-border hover:bg-card hover:text-foreground',
        'transition-colors cursor-pointer shrink-0'
    );

    const renderQueryPreview = (q: string) => {
        return buildFilterOrderQuery(q, value, orderValue);
    };

    const handleFilterChange = useCallback((nextValue: string) => {
        onChangeRef.current(normalizeFilterInput(nextValue));
    }, [normalizeFilterInput]);

    const handleOrderValueChange = useCallback((nextOrderValue: string) => {
        onOrderChangeRef.current?.(nextOrderValue);
    }, []);

    const commitOrderTerms = useCallback((nextTerms: OrderTerm[]) => {
        const nextExpr = serializeOrderByTerms(nextTerms);
        onOrderChangeRef.current?.(nextExpr);
    }, []);

    const handleAddOrderTerm = useCallback(() => {
        const field = selectedOrderField.trim();
        if (!field) return;
        const nextTerms = [...orderTerms, { field, dir: selectedOrderDir }];
        const nextExpr = serializeOrderByTerms(nextTerms);
        onOrderChangeRef.current?.(nextExpr);
        runNow(valueRef.current, nextExpr);
        setSelectedOrderField('');
        setSelectedOrderDir('ASC');
        setOrderBuilderOpen(false);
    }, [orderTerms, runNow, selectedOrderDir, selectedOrderField]);

    const handleRemoveOrderTerm = useCallback((index: number) => {
        const nextTerms = orderTerms.filter((_, idx) => idx !== index);
        const nextExpr = serializeOrderByTerms(nextTerms);
        onOrderChangeRef.current?.(nextExpr);
        runNow(valueRef.current, nextExpr);
    }, [orderTerms, runNow]);

    const handleOpenEditOrderTerm = useCallback((index: number) => {
        const target = orderTerms[index];
        if (!target) return;
        setSelectedOrderField(target.field);
        setSelectedOrderDir(target.dir);
        setEditingOrderIndex(index);
    }, [orderTerms]);

    const handleSaveOrderTerm = useCallback(() => {
        if (editingOrderIndex === null) return;
        const field = selectedOrderField.trim();
        if (!field) return;
        const nextTerms = [...orderTerms];
        nextTerms[editingOrderIndex] = { field, dir: selectedOrderDir };
        commitOrderTerms(nextTerms);
        setEditingOrderIndex(null);
        setSelectedOrderField('');
        setSelectedOrderDir('ASC');
    }, [commitOrderTerms, editingOrderIndex, orderTerms, selectedOrderDir, selectedOrderField]);

    const toggleOrderInputMode = useCallback(() => {
        if (orderInputMode === 'chips') {
            setOrderInputMode('text');
            return;
        }
        const parsed = parseOrderByTerms(orderValueRef.current, completionColumns);
        if (parsed.isCustom && orderValueRef.current.trim()) {
            toast.error('Cannot switch to chip mode: ORDER BY contains custom expression.');
            return;
        }
        setOrderInputMode('chips');
    }, [completionColumns, orderInputMode, toast]);

    return (
        <div className="flex items-center gap-1 shrink-0 relative py-1">
            {showFilterInput && (
                <div className="flex items-center w-full min-w-0 gap-2">
                    <div className={cn(
                        'flex items-center min-w-0 bg-card px-2 rounded-sm',
                        children ? 'flex-4' : 'flex-1',
                    )}>
                        <div
                            className="relative flex items-center"
                            onMouseEnter={() => {
                                tooltipTimeout.current && clearTimeout(tooltipTimeout.current);
                                setShowTooltip(true);
                            }}
                            onMouseLeave={() => {
                                if (tooltipTimeout.current) {
                                    window.clearTimeout(tooltipTimeout.current);
                                }
                                tooltipTimeout.current = setTimeout(() => setShowTooltip(false), 200);
                            }}
                        >
                            <span className="text-[11px] uppercase cursor-pointer font-semibold text-muted-foreground hover:text-foreground tracking-wide shrink-0 select-none transition-colors">
                                WHERE
                            </span>

                            {showTooltip && baseQuery && (
                                <div className="group min-h-40 absolute top-full left-0 z-panel-overlay mt-2 w-120 overflow-hidden rounded-sm bg-card shadow-2xl border border-border/50 animate-in fade-in zoom-in-95 duration-100">
                                    <div className="absolute right-2 top-2 z-10 flex flex-col items-center gap-0.5 rounded-sm bg-background/95 p-0.5 opacity-0 pointer-events-none transition-opacity duration-150 group-hover:opacity-100 group-hover:pointer-events-auto">
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className={iconBtn}
                                            title="Copy query"
                                            onClick={() => {
                                                void setClipboardText(buildFilterOrderQuery(baseQuery, value, orderValue))
                                                    .then(() => toast.success('Query copied to clipboard'))
                                                    .catch(() => toast.error('Failed to copy query'));
                                            }}
                                        >
                                            <Copy size={12} />
                                        </Button>

                                        {onAppendToQuery && (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className={cn(iconBtn, 'text-success hover:bg-success/10 hover:border-success/30')}
                                                title="Append to current tab (last line)"
                                                onClick={() => {
                                                    onAppendToQuery(buildFilterOrderQuery(baseQuery, value, orderValue));
                                                    setShowTooltip(false);
                                                }}
                                            >
                                                <PlusSquare size={12} />
                                            </Button>
                                        )}

                                        {onOpenInNewTab && (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className={cn(iconBtn, 'text-muted-foreground hover:text-foreground')}
                                                title="Open in new tab"
                                                onClick={() => {
                                                    onOpenInNewTab(buildFilterOrderQuery(baseQuery, value, orderValue));
                                                    setShowTooltip(false);
                                                }}
                                            >
                                                <ExternalLink size={12} />
                                            </Button>
                                        )}
                                    </div>
                                    <div className="p-3 pr-12 text-[11px] font-mono whitespace-pre-wrap max-h-[250px] overflow-y-auto text-muted-foreground">
                                        {renderQueryPreview(baseQuery.replace(/;\s*$/, '').trim())}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="ml-2 items-end flex-1 min-w-12.5 h-6 relative">
                            <Editor
                                path={modelPath}
                                theme={getMonacoTheme()}
                                defaultLanguage="sql"
                                value={value}
                                onMount={handleMonacoMount}
                                onChange={(next) => handleFilterChange(next ?? '')}
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
                                    fontSize: 11,
                                    lineHeight: 24,
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
                        </div>

                    </div>

                    <div className={cn(
                        'flex items-center min-w-0 bg-card rounded-sm',
                        children ? 'flex-[4]' : 'flex-1',
                    )}>
                        <span className="text-[11px] uppercase ml-2 font-semibold text-muted-foreground hover:text-foreground tracking-wide shrink-0 select-none transition-colors">
                            ORDER BY
                        </span>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="ml-2 h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
                            title={orderInputMode === 'chips' ? 'Switch to text mode' : 'Switch to chip mode'}
                            onClick={toggleOrderInputMode}
                        >
                            <ArrowLeftRight size={12} />
                        </Button>
                        {orderInputMode === 'chips' ? (
                            <>
                                {orderTerms.length > 0 && (
                                    <div className="ml-2 flex items-center gap-1 overflow-x-auto scrollbar-thin">
                                        {orderTerms.map((term, index) => (
                                            <Popover key={`${term.field}:${index}`} open={editingOrderIndex === index} onOpenChange={(open) => setEditingOrderIndex(open ? index : null)}>
                                                <PopoverTrigger asChild>
                                                    <Badge
                                                        variant="default"
                                                        className="cursor-pointer normal-case gap-1 pl-2 pr-1 py-1 text-[10px] shrink-0"
                                                        onClick={() => handleOpenEditOrderTerm(index)}
                                                    >
                                                        <span className="font-mono text-[11px]">{term.field}</span>
                                                        <span className="text-muted-foreground">{term.dir}</span>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-4 w-4 p-0 hover:bg-muted"
                                                            title="Remove order term"
                                                            onClick={(event) => {
                                                                event.stopPropagation();
                                                                handleRemoveOrderTerm(index);
                                                            }}
                                                        >
                                                            <X size={10} />
                                                        </Button>
                                                    </Badge>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-68 p-2" align="start" sideOffset={6}>
                                                    <div
                                                        className="space-y-2"
                                                        onKeyDown={(event) => {
                                                            if (event.key !== 'Enter') return;
                                                            event.preventDefault();
                                                            event.stopPropagation();
                                                            if (!selectedOrderField.trim()) return;
                                                            handleSaveOrderTerm();
                                                        }}
                                                    >
                                                        <div className="text-[11px] text-muted-foreground font-medium">Edit sort term</div>
                                                        <Select value={selectedOrderField} onValueChange={setSelectedOrderField}>
                                                            <SelectTrigger className="h-7 text-[12px]">
                                                                <SelectValue placeholder="Choose field" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {completionColumns.map((column) => (
                                                                    <SelectItem key={column} value={column}>
                                                                        <span className="font-mono text-[12px]">{column}</span>
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                        <Select value={selectedOrderDir} onValueChange={(v: string) => setSelectedOrderDir(v as OrderDirection)}>
                                                            <SelectTrigger className="h-7 text-[12px]">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="ASC">ASC</SelectItem>
                                                                <SelectItem value="DESC">DESC</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            className="h-7 w-full text-[12px]"
                                                            disabled={!selectedOrderField.trim()}
                                                            onClick={handleSaveOrderTerm}
                                                        >
                                                            Save
                                                        </Button>
                                                    </div>
                                                </PopoverContent>
                                            </Popover>
                                        ))}
                                    </div>
                                )}
                                <Popover open={orderBuilderOpen} onOpenChange={setOrderBuilderOpen}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="ml-2 h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
                                            title="Add ORDER BY term"
                                        >
                                            <Plus size={12} />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-68 p-2" align="start" sideOffset={6}>
                                        <div
                                            className="space-y-2"
                                            onKeyDown={(event) => {
                                                if (event.key !== 'Enter') return;
                                                event.preventDefault();
                                                event.stopPropagation();
                                                if (!selectedOrderField.trim()) return;
                                                handleAddOrderTerm();
                                            }}
                                        >
                                            <div className="text-[11px] text-muted-foreground font-medium">Add sort term</div>
                                            <Select value={selectedOrderField} onValueChange={setSelectedOrderField}>
                                                <SelectTrigger className="h-7 text-[12px]">
                                                    <SelectValue placeholder="Choose field" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {completionColumns.map((column) => (
                                                        <SelectItem key={column} value={column}>
                                                            <span className="font-mono text-[12px]">{column}</span>
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <Select value={selectedOrderDir} onValueChange={(v: string) => setSelectedOrderDir(v as OrderDirection)}>
                                                <SelectTrigger className="h-7 text-[12px]">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="ASC">ASC</SelectItem>
                                                    <SelectItem value="DESC">DESC</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <Button
                                                type="button"
                                                size="sm"
                                                className="h-7 w-full text-[12px]"
                                                disabled={!selectedOrderField.trim()}
                                                onClick={handleAddOrderTerm}
                                            >
                                                Add
                                            </Button>
                                        </div>
                                    </PopoverContent>
                                </Popover>
                            </>
                        ) : (
                            <Input
                                value={orderValue}
                                onChange={(event: React.ChangeEvent<HTMLInputElement>) => handleOrderValueChange(event.target.value)}
                                onKeyDown={(event: React.KeyboardEvent<HTMLInputElement>) => {
                                    if (event.key !== 'Enter') return;
                                    event.preventDefault();
                                    event.stopPropagation();
                                    runNow(valueRef.current, event.currentTarget.value);
                                }}
                                className="ml-2 h-6 w-full bg-transparent font-mono text-[12px]"
                                placeholder="created_at DESC, id ASC"
                            />
                        )}
                    </div>

                    {children && (
                        <div className="flex items-center justify-end min-w-0 gap-1 overflow-visible">
                            {children}
                        </div>
                    )}
                </div>
            )}
            {!showFilterInput && children && (
                <div className={cn(
                    'flex items-center justify-end min-w-0 gap-1 overflow-visible',
                    'flex-1',
                )}>
                    {children}
                </div>
            )}
        </div>
    );
};
