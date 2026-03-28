import React, { useRef, useEffect, useCallback } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import type { editor as MonacoEditor } from 'monaco-editor';
import { createRoot, type Root } from 'react-dom/client';
import { useSchemaStore } from '../../stores/schemaStore';
import { useConnectionStore } from '../../stores/connectionStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useBookmarkStore } from '../../stores/bookmarkStore';
import { useEditorStore } from '../../stores/editorStore';
import { registerContextAwareSQLCompletion } from '../../lib/monaco/sqlCompletion';
import { registerSqlFolding } from '../../lib/monaco/sqlFolding';
import { getSchemasForActiveDatabase } from '../../lib/monaco/sqlCompletionIdentifiers';
import { resolveSqlObjectNavigationAtPosition, resolveTableNavigationAtPosition, type SchemaObjectKind, type TableNavigationMatch } from '../../lib/monaco/sqlTableNavigation';
import { runCtrlClickTableNavigation } from './monacoTableNavigation';
import { ObjectQuickViewPanel } from './ObjectQuickViewPanel';
import { EditorToolbar } from './EditorToolbar';
import { DOM_EVENT, TAB_TYPE } from '../../lib/constants';
import { onCommand } from '../../lib/commandBus';
import { FormatSQL } from '../../services/queryService';
import { FetchTableColumns } from '../../services/schemaService';
import type { models } from '../../../wailsjs/go/models';

type EditorPosition = Parameters<MonacoEditor.IStandaloneCodeEditor['setPosition']>[0];

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
        header.textContent = 'Chon table';
        this.domNode.appendChild(header);

        const list = document.createElement('div');
        list.className = 'zentro-table-nav-widget__list';

        this.matches.forEach((match, index) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'zentro-table-nav-widget__item';
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
        this.root.unmount();
        this.editor.removeContentWidget(this);
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
    const ULTRA_COMPACT_GUTTER = {
        lineNumbersMinChars: 1,
        lineDecorationsWidth: 16,
    } as const;

    const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
    const monacoRef = useRef<Parameters<OnMount>[1] | null>(null);
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
    const ctrlHoverDecorationRef = useRef<string[]>([]);

    // Focus editor when it becomes active
    useEffect(() => {
        if (isActive && editorRef.current) {
            editorRef.current.focus();
        }
    }, [isActive]);

    const resolveRunnableQueryTarget = useCallback((): {
        query: string;
        range: {
            startLineNumber: number;
            startColumn: number;
            endLineNumber: number;
            endColumn: number;
        };
    } | null => {
        if (!editorRef.current) return null;
        const editor = editorRef.current;
        const selection = editor.getSelection();
        const model = editor.getModel();
        if (!model) return null;

        if (selection && !selection.isEmpty()) {
            const selectedText = model.getValueInRange(selection);
            if (!selectedText.trim()) return null;
            return { query: selectedText, range: selection };
        }

        const position = editor.getPosition();
        if (!position) return null;

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
            if (searchLine > lineCount) return null;
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

        const range = {
            startLineNumber: startLine,
            startColumn: 1,
            endLineNumber: endLine,
            endColumn: model.getLineMaxColumn(endLine),
        };
        const blockText = model.getValueInRange(range);

        if (!blockText.trim()) return null;

        return { query: blockText, range };
    }, []);

    const extractRunnableQuery = useCallback(() => resolveRunnableQueryTarget()?.query || '', [resolveRunnableQueryTarget]);

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
    const addTab = useEditorStore((s) => s.addTab);
    const { fontSize, theme, updateFontSize } = useSettingsStore();
    const { byTab, loadBookmarks, toggleLine, nextLine } = useBookmarkStore();
    const bookmarks = byTab[tabId] || [];
    const toggleLineRef = useRef(toggleLine);
    toggleLineRef.current = toggleLine;
    const activeProfileNameRef = useRef(activeProfile?.name);
    activeProfileNameRef.current = activeProfile?.name;
    const activeProfileRef = useRef(activeProfile);
    activeProfileRef.current = activeProfile;
    const treesRef = useRef(trees);
    treesRef.current = trees;
    const addTabRef = useRef(addTab);
    addTabRef.current = addTab;
    const navWidgetRef = useRef<InlineTableNavigationWidget | null>(null);
    const quickViewWidgetRef = useRef<InlineObjectQuickViewWidget | null>(null);

    const applyBookmarkDecorations = useCallback(() => {
        const editor = editorRef.current;
        const monaco = monacoRef.current;
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

    useEffect(() => () => {
        navWidgetRef.current?.dispose();
        navWidgetRef.current = null;
        quickViewWidgetRef.current?.dispose();
        quickViewWidgetRef.current = null;
    }, []);

    // Resolve 'system' theme to actual monaco theme
    const getMonacoTheme = () => {
        if (theme === 'dark') return 'vs-dark';
        if (theme === 'light') return 'vs';
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'vs-dark' : 'vs';
    };

    const handleMount: OnMount = useCallback((editor, monacoInstance) => {
        editorRef.current = editor;
        monacoRef.current = monacoInstance;
        navWidgetRef.current?.dispose();
        navWidgetRef.current = new InlineTableNavigationWidget(editor, monacoInstance);
        quickViewWidgetRef.current?.dispose();
        quickViewWidgetRef.current = new InlineObjectQuickViewWidget(editor, monacoInstance);
        let lastHoverPosition: EditorPosition | null = null;
        let modifierPressed = false;
        let hoverQuickViewTimer: ReturnType<typeof setTimeout> | null = null;
        let lastHoverQuickViewKey = '';

        const clearCtrlHoverDecoration = () => {
            ctrlHoverDecorationRef.current = editor.deltaDecorations(ctrlHoverDecorationRef.current, []);
        };

        const clearHoverQuickViewTimer = () => {
            if (!hoverQuickViewTimer) return;
            clearTimeout(hoverQuickViewTimer);
            hoverQuickViewTimer = null;
        };

        const applyCtrlHoverDecoration = (position: EditorPosition | null) => {
            if (!position || !modifierPressed) {
                clearCtrlHoverDecoration();
                return;
            }

            const model = editor.getModel();
            const profile = activeProfileRef.current;
            const profileName = profile?.name || '';
            const dbName = profile?.db_name || '';
            if (!model || !profileName || !dbName) {
                clearCtrlHoverDecoration();
                return;
            }

            const schemas = getSchemasForActiveDatabase(treesRef.current, profileName, dbName);
            const navigation = resolveTableNavigationAtPosition(model, position, schemas);
            if (navigation.kind === 'not_found') {
                clearCtrlHoverDecoration();
                return;
            }

            const word = model.getWordAtPosition(position);
            if (!word) {
                clearCtrlHoverDecoration();
                return;
            }

            const range = new monacoInstance.Range(
                position.lineNumber,
                word.startColumn,
                position.lineNumber,
                word.endColumn,
            );

            ctrlHoverDecorationRef.current = editor.deltaDecorations(ctrlHoverDecorationRef.current, [{
                range,
                options: {
                    inlineClassName: 'zentro-table-nav-hover',
                },
            }]);
        };

        const openDefinition = (target: TableNavigationMatch) => {
            addTabRef.current({
                type: TAB_TYPE.TABLE,
                name: target.qualifiedName,
                content: target.qualifiedName,
                query: '',
            });
        };

        const previewObject = async (target: TableNavigationMatch, position: EditorPosition) => {
            const profile = activeProfileRef.current;
            const profileName = profile?.name || '';
            const dbName = profile?.db_name || '';
            if (!profileName || !dbName) {
                navWidgetRef.current?.showHint('Khong tim thay table trong context', position);
                return;
            }

            quickViewWidgetRef.current?.showLoading(target, position, () => openDefinition(target));

            if (target.objectKind === 'function') {
                quickViewWidgetRef.current?.showMessage(
                    target,
                    position,
                    'Stored procedure/function quick preview se bo sung tiep. Hien tai ban co the mo definition.',
                    () => openDefinition(target),
                );
                return;
            }

            const columns = await FetchTableColumns(target.schemaName, target.tableName);
            quickViewWidgetRef.current?.showColumns(
                target,
                position,
                columns,
                () => openDefinition(target),
            );
        };

        // Register SQL completion provider
        registerContextAwareSQLCompletion(monacoInstance);
        registerSqlFolding(monacoInstance);

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
            navWidgetRef.current?.hide();
            clearCtrlHoverDecoration();
            clearHoverQuickViewTimer();
        });

        // Bind run query directly on this editor instance for reliable Ctrl/Cmd+Enter behavior.
        editor.addCommand(
            monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.Enter,
            () => {
                if (runQueryRef.current) runQueryRef.current();
            }
        );

        editor.onMouseDown((e) => {
            const browserEvent = e?.event?.browserEvent as MouseEvent | undefined;
            const targetType = e?.target?.type;
            const mt = monacoInstance.editor.MouseTargetType;
            const inContentText = targetType === mt.CONTENT_TEXT;
            const clickPosition = e?.target?.position;

            const isModifierClick = Boolean(browserEvent && (browserEvent.ctrlKey || browserEvent.metaKey) && browserEvent.button === 0);
            if (isModifierClick && isActiveRef.current) {
                if (inContentText) {
                    const model = editor.getModel();

                    if (model && clickPosition) {
                        runCtrlClickTableNavigation({
                            model,
                            position: clickPosition,
                            profile: activeProfileRef.current,
                            trees: treesRef.current,
                            onOpenTable: openDefinition,
                            onShowHint: (message, position) => navWidgetRef.current?.showHint(message, position),
                            onShowPicker: (matches, position, onPick) => navWidgetRef.current?.showPicker(matches, position, onPick),
                        });
                    }

                    browserEvent?.preventDefault();
                    browserEvent?.stopPropagation();
                    return;
                }
            }

            const isRightClick = Boolean(e?.event?.rightButton) || e?.event?.browserEvent?.button === 2;
            if (!isRightClick) return;
            if (readOnlyRef.current) return;
            if (!isActiveRef.current) return;

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

        editor.onMouseMove((e) => {
            const targetType = e?.target?.type;
            const mt = monacoInstance.editor.MouseTargetType;
            if (targetType !== mt.CONTENT_TEXT) {
                lastHoverPosition = null;
                clearCtrlHoverDecoration();
                clearHoverQuickViewTimer();
                return;
            }
            const browserEvent = e?.event?.browserEvent as MouseEvent | undefined;
            modifierPressed = Boolean(browserEvent?.ctrlKey || browserEvent?.metaKey);
            lastHoverPosition = e?.target?.position || null;
            applyCtrlHoverDecoration(lastHoverPosition);

            const noModifier = !browserEvent?.ctrlKey && !browserEvent?.metaKey && !browserEvent?.shiftKey && !browserEvent?.altKey;
            const model = editor.getModel();
            const profile = activeProfileRef.current;
            const profileName = profile?.name || '';
            const dbName = profile?.db_name || '';
            if (!noModifier || !model || !lastHoverPosition || !profileName || !dbName) {
                clearHoverQuickViewTimer();
                return;
            }

            const schemas = getSchemasForActiveDatabase(treesRef.current, profileName, dbName);
            const resolved = resolveSqlObjectNavigationAtPosition(model, lastHoverPosition, schemas);
            if (resolved.kind !== 'single_match') {
                clearHoverQuickViewTimer();
                lastHoverQuickViewKey = '';
                return;
            }

            const hoverKey = `${resolved.match.objectKind}:${resolved.match.qualifiedName}`;
            if (hoverKey === lastHoverQuickViewKey) return;
            clearHoverQuickViewTimer();
            hoverQuickViewTimer = setTimeout(() => {
                lastHoverQuickViewKey = hoverKey;
                void previewObject(resolved.match, lastHoverPosition!);
            }, 320);
        });

        editor.onMouseLeave(() => {
            lastHoverPosition = null;
            clearCtrlHoverDecoration();
            clearHoverQuickViewTimer();
        });

        const handleModifierKey = (event: KeyboardEvent) => {
            const nextPressed = Boolean(event.ctrlKey || event.metaKey);
            if (nextPressed === modifierPressed) return;
            modifierPressed = nextPressed;
            if (!modifierPressed) {
                clearCtrlHoverDecoration();
                return;
            }
            applyCtrlHoverDecoration(lastHoverPosition);
        };

        window.addEventListener('keydown', handleModifierKey, true);
        window.addEventListener('keyup', handleModifierKey, true);

        editor.onDidDispose(() => {
            window.removeEventListener('keydown', handleModifierKey, true);
            window.removeEventListener('keyup', handleModifierKey, true);
            clearCtrlHoverDecoration();
            clearHoverQuickViewTimer();
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
            const model = editorRef.current.getModel();
            if (!model) return;
            const target = resolveRunnableQueryTarget() || {
                query: model.getValue(),
                range: model.getFullModelRange(),
            };
            if (!target.query.trim()) return;
            try {
                const dialect = activeProfile?.driver || '';
                const formatted = await FormatSQL(target.query, dialect);
                model.pushEditOperations([], [{
                    range: target.range,
                    text: formatted
                }], () => null);
                onChange(model.getValue());
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
    }, [activeProfile?.driver, activeProfile?.name, nextLine, onChange, resolveRunnableQueryTarget, tabId, toggleLine]);

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

