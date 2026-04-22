import React, { useRef } from 'react';
import Editor, { useMonaco } from '@monaco-editor/react';
import { useSchemaStore } from '../../stores/schemaStore';
import { useConnectionStore } from '../../stores/connectionStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { EditorToolbar } from './EditorToolbar';
import { useEditorAutoFocus } from './hooks/useEditorAutoFocus';
import { useEditorGlobalRunAction } from './hooks/useEditorGlobalRunAction';
import { useEditorRunQuery } from './hooks/useEditorRunQuery';
import { useEditorSqlCompletion } from './hooks/useEditorSqlCompletion';
import { useEditorTheme } from './hooks/useEditorTheme';
import { useMonacoEditorMount } from './hooks/useMonacoEditorMount';

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

class InlineTableNavigationWidget implements MonacoEditor.IContentWidget {
    private readonly id = `zentro-table-nav-${crypto.randomUUID()}`;
    private readonly domNode: HTMLDivElement;
    private position: EditorPosition | null = null;
    private hideTimer: ReturnType<typeof setTimeout> | null = null;
    private keydownHandler: ((event: KeyboardEvent) => void) | null = null;
    private outsidePointerHandler: ((event: PointerEvent) => void) | null = null;
    private matches: TableNavigationMatch[] = [];
    private selectedIndex = 0;
    private onPick: ((match: TableNavigationMatch) => void) | null = null;

    constructor(
        private readonly editor: MonacoEditor.IStandaloneCodeEditor,
        private readonly monaco: Parameters<OnMount>[1],
    ) {
        this.domNode = document.createElement('div');
        this.domNode.className = 'zentro-table-nav-widget hidden';
        this.editor.addContentWidget(this);
    }

    getId(): string {
        return this.id;
    }

    getDomNode(): HTMLElement {
        return this.domNode;
    }

    getPosition(): MonacoEditor.IContentWidgetPosition | null {
        if (!this.position) return null;
        return {
            position: this.position,
            preference: [this.monaco.editor.ContentWidgetPositionPreference.BELOW],
        };
    }

    showHint(message: string, position: EditorPosition, timeoutMs = 1600) {
        this.clearPickerListeners();
        this.clearTimer();
        this.position = position;
        this.domNode.className = 'zentro-table-nav-widget zentro-table-nav-widget--hint';
        this.domNode.textContent = message;
        this.editor.layoutContentWidget(this);
        this.hideTimer = setTimeout(() => this.hide(), timeoutMs);
    }

    showPicker(matches: TableNavigationMatch[], position: EditorPosition, onPick: (match: TableNavigationMatch) => void) {
        this.clearTimer();
        this.clearPickerListeners();
        this.position = position;
        this.matches = matches;
        this.selectedIndex = 0;
        this.onPick = onPick;

        this.renderPicker();
        this.domNode.className = 'zentro-table-nav-widget zentro-table-nav-widget--picker';
        this.editor.layoutContentWidget(this);
        this.bindPickerListeners();
    }

    hide() {
        this.clearTimer();
        this.clearPickerListeners();
        this.position = null;
        this.matches = [];
        this.selectedIndex = 0;
        this.onPick = null;
        this.domNode.className = 'zentro-table-nav-widget hidden';
        this.domNode.innerHTML = '';
        this.editor.layoutContentWidget(this);
    }

    dispose() {
        this.hide();
        this.editor.removeContentWidget(this);
    }

    private renderPicker() {
        this.domNode.innerHTML = '';

        const header = document.createElement('div');
        header.className = 'zentro-table-nav-widget__header';
        header.textContent = 'Choose table';
        this.domNode.appendChild(header);

        const list = document.createElement('div');
        list.className = 'zentro-table-nav-widget__list';
        list.setAttribute('role', 'listbox');
        list.setAttribute('aria-label', 'Table list');
        list.setAttribute('tabindex', '-1');

        this.matches.forEach((match, index) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.id = `zentro-table-nav-option-${index}`;
            button.className = 'zentro-table-nav-widget__item';
            button.setAttribute('role', 'option');
            button.setAttribute('aria-selected', index === this.selectedIndex ? 'true' : 'false');
            if (index === this.selectedIndex) {
                button.classList.add('is-active');
            }
            button.textContent = match.qualifiedName;
            button.addEventListener('mousedown', (event) => {
                event.preventDefault();
                event.stopPropagation();
            });
            button.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                this.pickIndex(index);
            });
            list.appendChild(button);
        });

        const activeOptionId = `zentro-table-nav-option-${this.selectedIndex}`;
        list.setAttribute('aria-activedescendant', activeOptionId);

        this.domNode.appendChild(list);
    }

    private bindPickerListeners() {
        this.keydownHandler = (event: KeyboardEvent) => {
            if (!this.position || this.matches.length === 0) return;
            if (event.key === 'Escape') {
                event.preventDefault();
                this.hide();
                return;
            }
            if (event.key === 'ArrowDown') {
                event.preventDefault();
                this.selectedIndex = (this.selectedIndex + 1) % this.matches.length;
                this.renderPicker();
                return;
            }
            if (event.key === 'ArrowUp') {
                event.preventDefault();
                this.selectedIndex = (this.selectedIndex - 1 + this.matches.length) % this.matches.length;
                this.renderPicker();
                return;
            }
            if (event.key === 'Enter') {
                event.preventDefault();
                this.pickIndex(this.selectedIndex);
            }
        };

        this.outsidePointerHandler = (event: PointerEvent) => {
            if (!this.domNode.contains(event.target as Node)) {
                this.hide();
            }
        };

        window.addEventListener('keydown', this.keydownHandler, true);
        window.addEventListener('pointerdown', this.outsidePointerHandler, true);
    }

    private pickIndex(index: number) {
        const match = this.matches[index];
        if (!match || !this.onPick) return;
        this.onPick(match);
        this.hide();
    }

    private clearTimer() {
        if (!this.hideTimer) return;
        clearTimeout(this.hideTimer);
        this.hideTimer = null;
    }

    private clearPickerListeners() {
        if (this.keydownHandler) {
            window.removeEventListener('keydown', this.keydownHandler, true);
            this.keydownHandler = null;
        }
        if (this.outsidePointerHandler) {
            window.removeEventListener('pointerdown', this.outsidePointerHandler, true);
            this.outsidePointerHandler = null;
        }
    }
}

class InlineObjectQuickViewWidget implements MonacoEditor.IContentWidget {
    private readonly id = `zentro-object-quickview-${crypto.randomUUID()}`;
    private readonly domNode: HTMLDivElement;
    private readonly root: Root;
    private position: EditorPosition | null = null;
    private keydownHandler: ((event: KeyboardEvent) => void) | null = null;
    private outsidePointerHandler: ((event: PointerEvent) => void) | null = null;

    constructor(
        private readonly editor: MonacoEditor.IStandaloneCodeEditor,
        private readonly monaco: Parameters<OnMount>[1],
    ) {
        this.domNode = document.createElement('div');
        this.domNode.className = 'hidden';
        this.root = createRoot(this.domNode);
        this.domNode.addEventListener('wheel', (event) => {
            event.stopPropagation();
        }, { passive: true });
        this.editor.addContentWidget(this);
    }

    getId(): string {
        return this.id;
    }

    getDomNode(): HTMLElement {
        return this.domNode;
    }

    getPosition(): MonacoEditor.IContentWidgetPosition | null {
        if (!this.position) return null;
        return {
            position: this.position,
            preference: [this.monaco.editor.ContentWidgetPositionPreference.BELOW],
        };
    }

    showLoading(match: TableNavigationMatch, position: EditorPosition, onOpenDefinition?: (() => void) | null) {
        this.position = position;
        this.domNode.className = '';
        this.render({
            title: `${toObjectTitle(match.objectKind)} - ${match.qualifiedName}`,
            loading: true,
            columns: [],
            message: null,
            onOpenDefinition: onOpenDefinition ?? null,
        });
        this.bindDismissListeners();
        this.editor.layoutContentWidget(this);
    }

    showColumns(
        match: TableNavigationMatch,
        position: EditorPosition,
        columns: models.ColumnDef[],
        onOpenDefinition?: (() => void) | null,
    ) {
        this.position = position;
        this.domNode.className = '';
        this.render({
            title: `${toObjectTitle(match.objectKind)} - ${match.qualifiedName}`,
            loading: false,
            columns,
            message: null,
            onOpenDefinition: onOpenDefinition ?? null,
        });
        this.bindDismissListeners();
        this.editor.layoutContentWidget(this);
    }

    showMessage(match: TableNavigationMatch, position: EditorPosition, message: string, onOpenDefinition?: (() => void) | null) {
        this.position = position;
        this.domNode.className = '';
        this.render({
            title: `${toObjectTitle(match.objectKind)} - ${match.qualifiedName}`,
            loading: false,
            columns: [],
            message,
            onOpenDefinition: onOpenDefinition ?? null,
        });
        this.bindDismissListeners();
        this.editor.layoutContentWidget(this);
    }

    hide() {
        this.clearDismissListeners();
        this.position = null;
        this.domNode.className = 'hidden';
        this.root.render(null);
        this.editor.layoutContentWidget(this);
    }

    dispose() {
        this.hide();
        this.editor.removeContentWidget(this);
        queueMicrotask(() => {
            this.root.unmount();
        });
    }

    private bindDismissListeners() {
        this.clearDismissListeners();
        this.keydownHandler = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                this.hide();
            }
        };
        this.outsidePointerHandler = (event: PointerEvent) => {
            if (!this.domNode.contains(event.target as Node)) {
                this.hide();
            }
        };
        window.addEventListener('keydown', this.keydownHandler, true);
        window.addEventListener('pointerdown', this.outsidePointerHandler, true);
    }

    private clearDismissListeners() {
        if (this.keydownHandler) {
            window.removeEventListener('keydown', this.keydownHandler, true);
            this.keydownHandler = null;
        }
        if (this.outsidePointerHandler) {
            window.removeEventListener('pointerdown', this.outsidePointerHandler, true);
            this.outsidePointerHandler = null;
        }
    }

    private render(props: {
        title: string;
        loading: boolean;
        columns: models.ColumnDef[];
        message: string | null;
        onOpenDefinition: (() => void) | null;
    }) {
        this.root.render(
            <ObjectQuickViewPanel
                title={props.title}
                loading={props.loading}
                columns={props.columns}
                message={props.message}
                onOpenDefinition={props.onOpenDefinition}
            />
        );
    }
}

function toObjectTitle(kind: SchemaObjectKind): string {
    switch (kind) {
        case 'view': return 'View';
        case 'materialized_view': return 'Materialized View';
        case 'foreign_table': return 'Foreign Table';
        case 'function': return 'Function';
        default: return 'Table';
    }
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
    const monaco = useMonaco();
    const editorRef = useRef<any>(null);
    const onFocusRef = useRef(onFocus);
    onFocusRef.current = onFocus;
    const isActiveRef = useRef(isActive);
    isActiveRef.current = isActive;
    const runQueryRef = useRef<() => void>();

    useEditorAutoFocus(isActive, editorRef);

    const runQuery = useEditorRunQuery({ editorRef, onRun });

    const extractRunnableQuery = useCallback(() => resolveRunnableQueryTarget()?.query || '', [resolveRunnableQueryTarget]);

    const runQueryRef = useRef<() => void>();
    const runQuery = useCallback(() => {
        const query = extractRunnableQuery();
        if (!query) return;
        onRunRef.current(query);
    }, [extractRunnableQuery]);
    runQueryRef.current = runQuery;

    useEditorGlobalRunAction({ tabId, isActiveRef, runQuery });

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
    const addTab = useEditorStore((s) => s.addTab);
    const { fontSize, theme, updateFontSize } = useSettingsStore();
    void activeProfile;
    void trees;

    const monacoTheme = useEditorTheme(theme);

    useEditorSqlCompletion(monaco);

    const handleMount = useMonacoEditorMount({
        tabId,
        editorRef,
        isActiveRef,
        onFocusRef,
        runQueryRef,
        updateFontSize,
    });

    return (
        <div
            className="zentro-sql-editor flex h-full overflow-hidden"
            style={
                {
                    '--zentro-editor-font-size': `${fontSize}px`,
                    '--zentro-editor-line-height': `${fontSize * 1.5}px`,
                } as React.CSSProperties
            }
        >
            <EditorToolbar isActive={isActive} tabId={tabId} readOnly={readOnly} />
            <div className="flex-1 min-h-0 min-w-0">
                <Editor
                    height="100%"
                    defaultLanguage="sql"
                    theme={monacoTheme}
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
        </div>
    );
};

