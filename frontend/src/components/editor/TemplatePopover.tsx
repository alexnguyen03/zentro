import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, X, Trash2, Search, AlertCircle, FilePlus } from 'lucide-react';
import { useTemplateStore } from '../../stores/templateStore';
import { useEditorStore } from '../../stores/editorStore';
import { useSettingsStore } from '../../stores/settingsStore';
import type { models } from '../../../wailsjs/go/models';
import { Button, ConfirmationModal, Input, Spinner } from '../ui';
import { cn } from '../../lib/cn';

type Template = models.Template;
type EditableField = 'name' | 'trigger' | 'content';
type EditingCell = { id: string; field: EditableField } | null;

interface TemplatePopoverProps {
    onClose: () => void;
    anchorRect: DOMRect | null;
    tabId?: string;
    isActive?: boolean;
    readOnly?: boolean;
}

const POPOVER_WIDTH = 760;
const POPOVER_HEIGHT = 420;
const VIEWPORT_PADDING = 8;
const ANCHOR_GAP = 8;
const ROW_H = 28;

export const TemplatePopover: React.FC<TemplatePopoverProps> = ({
    onClose,
    anchorRect,
    tabId,
    isActive,
    readOnly,
}) => {
    const { templates, saveTemplate, deleteTemplate, isLoading } = useTemplateStore();
    const groups = useEditorStore((state) => state.groups);
    const updateTabQuery = useEditorStore((state) => state.updateTabQuery);
    const viewMode = useSettingsStore((state) => state.viewMode);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [pendingDeleteIds, setPendingDeleteIds] = useState<string[]>([]);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [filter, setFilter] = useState('');
    const [draftTemplates, setDraftTemplates] = useState<Template[]>([]);
    const [focusNewlyAdded, setFocusNewlyAdded] = useState(false);
    const [editingCell, setEditingCell] = useState<EditingCell>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const prevTemplatesCount = useRef(templates.length);

    const canAppendToEditor = Boolean(tabId && isActive && !readOnly && !viewMode);

    useEffect(() => {
        setDraftTemplates(templates);

        if (focusNewlyAdded && templates.length > prevTemplatesCount.current) {
            const newTemplate = templates[templates.length - 1];
            if (newTemplate?.id) {
                setEditingCell({ id: newTemplate.id, field: 'name' });
            }
            setFocusNewlyAdded(false);
        }
        prevTemplatesCount.current = templates.length;
    }, [templates, focusNewlyAdded]);

    useEffect(() => {
        if (!editingCell) return;
        const exists = draftTemplates.some((template) => template.id === editingCell.id);
        if (!exists) {
            setEditingCell(null);
        }
    }, [draftTemplates, editingCell]);

    const filteredTemplates = useMemo(() => {
        const keyword = filter.trim().toLowerCase();
        if (!keyword) return draftTemplates;
        return draftTemplates.filter((template) =>
            (template.name || '').toLowerCase().includes(keyword)
            || (template.trigger || '').toLowerCase().includes(keyword)
            || (template.content || '').toLowerCase().includes(keyword)
        );
    }, [draftTemplates, filter]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
                return;
            }

            if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;

            if (event.key === 'Delete' && selectedIds.size > 0) {
                requestDeleteTemplates(Array.from(selectedIds));
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose, selectedIds]);

    const requestDeleteTemplates = (ids: string[]) => {
        if (ids.length === 0) return;
        setPendingDeleteIds(ids);
        setShowDeleteConfirm(true);
    };

    const confirmDeleteTemplates = async () => {
        const ids = pendingDeleteIds;
        if (ids.length === 0) return;
        setSelectedIds(new Set());
        setDraftTemplates((prev) => prev.filter((template) => !ids.includes(template.id)));
        await Promise.all(ids.map((id) => deleteTemplate(id)));
        setPendingDeleteIds([]);
    };

    const handleAdd = async () => {
        const newTemplate: Template = {
            id: '',
            name: 'New Template',
            trigger: 'abbr',
            content: 'SELECT * FROM table;',
        };
        setFocusNewlyAdded(true);
        await saveTemplate(newTemplate);
    };

    const handleDraftUpdate = (id: string, field: keyof Template, value: string) => {
        setDraftTemplates((prev) => prev.map((template) => (
            template.id === id ? { ...template, [field]: value } : template
        )));
    };

    const handleBlur = async (id: string, field: keyof Template, value: string) => {
        const original = templates.find((template) => template.id === id);
        if (original && original[field] === value) return;

        const current = draftTemplates.find((template) => template.id === id);
        if (current) {
            await saveTemplate(current);
        }
    };

    const stopActionEvent = (event: React.MouseEvent<HTMLButtonElement> | React.PointerEvent<HTMLButtonElement>) => {
        event.preventDefault();
        event.stopPropagation();
    };

    const beginInlineEdit = (id: string, field: EditableField) => {
        setEditingCell({ id, field });
    };

    const handleInlineBlur = async (id: string, field: EditableField, value: string) => {
        await handleBlur(id, field, value);
        setEditingCell((current) => (
            current?.id === id && current.field === field ? null : current
        ));
    };

    const handleInlineKeyDown = (
        event: React.KeyboardEvent<HTMLInputElement>,
        id: string,
        field: EditableField,
    ) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            event.currentTarget.blur();
            return;
        }

        if (event.key === 'Escape') {
            event.preventDefault();
            const original = templates.find((template) => template.id === id);
            if (original) {
                handleDraftUpdate(id, field, String(original[field] || ''));
            }
            setEditingCell(null);
            event.currentTarget.blur();
        }
    };

    const renderEditableCell = (
        row: Template,
        field: EditableField,
        cellStyle?: React.CSSProperties,
    ) => {
        const value = String(row[field] || '');
        const isEditing = editingCell?.id === row.id && editingCell.field === field;

        if (isEditing) {
            return (
                <Input
                    data-name-id={field === 'name' ? row.id : undefined}
                    type="text"
                    value={value}
                    autoFocus
                    className="rounded-none border-ring bg-background px-1.5 py-0 text-[11px] leading-none focus-visible:border-primary"
                    style={{ height: '100%', ...cellStyle }}
                    onChange={(event) => handleDraftUpdate(row.id, field, event.target.value)}
                    onBlur={(event) => {
                        void handleInlineBlur(row.id, field, event.target.value);
                    }}
                    onKeyDown={(event) => handleInlineKeyDown(event, row.id, field)}
                    onClick={(event) => event.stopPropagation()}
                />
            );
        }

        return (
            <div
                className="rt-cell-content rt-cell-content--compact"
                title={value || undefined}
                style={cellStyle}
                onDoubleClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    beginInlineEdit(row.id, field);
                }}
            >
                {value || ' '}
            </div>
        );
    };

    const handleAppend = (template: Template) => {
        if (!canAppendToEditor || !tabId) return;
        if (!template.content?.trim()) return;

        const currentTab = groups
            .flatMap((group) => group.tabs)
            .find((tab) => tab.id === tabId);

        if (!currentTab) return;
        const base = currentTab.query.trimEnd();
        const nextQuery = base ? `${base}\n\n${template.content}` : template.content;
        updateTabQuery(tabId, nextQuery);
    };

    const toggleSelect = (id: string, multi: boolean) => {
        const next = new Set(selectedIds);
        if (multi) {
            if (next.has(id)) next.delete(id);
            else next.add(id);
        } else {
            next.clear();
            next.add(id);
        }
        setSelectedIds(next);
    };

    const popoverStyle: React.CSSProperties = useMemo(() => {
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const fallbackLeft = Math.max(VIEWPORT_PADDING, Math.round((viewportWidth - POPOVER_WIDTH) / 2));
        const fallbackTop = Math.max(VIEWPORT_PADDING, Math.round((viewportHeight - POPOVER_HEIGHT) / 2));

        if (!anchorRect) {
            return {
                position: 'fixed',
                top: fallbackTop,
                left: fallbackLeft,
                width: POPOVER_WIDTH,
                height: POPOVER_HEIGHT,
            };
        }

        let left = anchorRect.right + ANCHOR_GAP;
        let top = anchorRect.top;

        if (left + POPOVER_WIDTH + VIEWPORT_PADDING > viewportWidth) {
            left = anchorRect.left - POPOVER_WIDTH - ANCHOR_GAP;
        }

        left = Math.max(VIEWPORT_PADDING, Math.min(left, viewportWidth - POPOVER_WIDTH - VIEWPORT_PADDING));
        top = Math.max(VIEWPORT_PADDING, Math.min(top, viewportHeight - POPOVER_HEIGHT - VIEWPORT_PADDING));

        return {
            position: 'fixed',
            top: Math.round(top),
            left: Math.round(left),
            width: POPOVER_WIDTH,
            height: POPOVER_HEIGHT,
        };
    }, [anchorRect]);

    return (
        <div
            ref={containerRef}
            style={popoverStyle}
            className="z-popover flex flex-col overflow-hidden rounded-sm border border-border/50 bg-card shadow-2xl animate-in fade-in zoom-in-95 duration-150"
        >
            {/* Header / filter bar */}
            <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
                <div className="flex min-w-0 items-center gap-2">
                    <h3 className="truncate text-small text-foreground">TEMPLATES</h3>
                    <span className="rounded-sm border border-border bg-background px-1.5 py-0.5 text-label text-muted-foreground">
                        {templates.length}
                    </span>
                </div>
                <div className="flex items-center gap-1">
                    <div className="relative w-50">
                        <Search
                            className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                            size={13}
                        />
                        <Input
                            value={filter}
                            onChange={(event) => setFilter(event.target.value)}
                            className="pl-7"
                            placeholder="Filter"
                            title="Filter templates"
                        />
                    </div>
                    {selectedIds.size > 0 && (
                        <span
                            className="ml-0.5 rounded-sm px-1.5 py-0.5 text-label"
                            style={{
                                border: '1px solid color-mix(in srgb, var(--status-success) 30%, transparent)',
                                background: 'color-mix(in srgb, var(--status-success) 10%, transparent)',
                                color: 'var(--status-success)',
                            }}
                        >
                            {selectedIds.size}
                        </span>
                    )}
                    <Button
                        variant="ghost"
                        size="icon"
                        title="Delete selected templates"
                        disabled={selectedIds.size === 0}
                        style={selectedIds.size > 0 ? {
                            color: 'color-mix(in srgb, var(--status-error) 80%, transparent)',
                        } : undefined}
                        className="hover:text-error hover:bg-error/10"
                        onClick={() => requestDeleteTemplates(Array.from(selectedIds))}
                    >
                        <Trash2 size={14} />
                    </Button>
                    <Button variant="ghost" size="icon" title="Add template" onClick={() => void handleAdd()}>
                        <Plus size={14} />
                    </Button>
                    <Button variant="ghost" size="icon" title="Close" onClick={onClose}>
                        <X size={14} />
                    </Button>
                </div>
            </div>

            {/* Table */}
            <div className="min-h-0 flex-1 overflow-auto">
                {filteredTemplates.length > 0 ? (
                    <table
                        className="result-table-tanstack"
                        style={{ width: '100%', tableLayout: 'fixed' }}
                    >
                        <thead>
                            <tr>
                                <th className="rt-th rt-index-sticky" style={{ width: 40 }}>
                                    <span className="rt-th-label" style={{ justifyContent: 'center' }}>#</span>
                                </th>
                                <th className="rt-th" style={{ width: '26%' }}>
                                    <span className="rt-th-label">Name</span>
                                </th>
                                <th className="rt-th" style={{ width: '18%' }}>
                                    <span className="rt-th-label">Shortcut</span>
                                </th>
                                <th className="rt-th">
                                    <span className="rt-th-label">SQL Content</span>
                                </th>
                                <th className="rt-th" style={{ width: 84, borderRight: 'none' }}>
                                    <span className="sr-only">Actions</span>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredTemplates.map((row, index) => (
                                <tr
                                    key={row.id}
                                    className={cn(
                                        'cursor-pointer',
                                        index % 2 !== 0 && 'rt-row-alt',
                                        selectedIds.has(row.id) && 'rt-row-selected',
                                    )}
                                    onClick={(event) => {
                                        const target = event.target as HTMLElement;
                                        if (target.closest('input, button')) return;
                                        toggleSelect(row.id, Boolean(event.ctrlKey || event.metaKey || event.shiftKey));
                                    }}
                                >
                                    <td
                                        className={cn(
                                            'rt-index-sticky',
                                            selectedIds.has(row.id) && 'rt-index-sticky-row-selected',
                                        )}
                                        style={{ width: 40, height: ROW_H }}
                                    >
                                        <div className="rt-cell-content rt-cell-content--compact row-num-col">
                                            {index + 1}
                                        </div>
                                    </td>
                                    <td style={{ height: ROW_H }}>
                                        {renderEditableCell(row, 'name')}
                                    </td>
                                    <td style={{ height: ROW_H }}>
                                        {renderEditableCell(row, 'trigger', { color: 'var(--status-warning)' })}
                                    </td>
                                    <td style={{ height: ROW_H }}>
                                        {renderEditableCell(row, 'content')}
                                    </td>
                                    <td style={{ height: ROW_H, borderRight: 'none', paddingRight: 4 }}>
                                        <div className="flex items-center justify-end gap-1">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                title="Append to current editor"
                                                disabled={!canAppendToEditor || !row.content?.trim()}
                                                onMouseDown={stopActionEvent}
                                                onPointerDown={stopActionEvent}
                                                onClick={(event) => {
                                                    event.preventDefault();
                                                    event.stopPropagation();
                                                    handleAppend(row);
                                                }}
                                            >
                                                <FilePlus size={14} />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                title="Delete template"
                                                style={{ color: 'color-mix(in srgb, var(--status-error) 80%, transparent)' }}
                                                className="hover:text-error hover:bg-error/10"
                                                onMouseDown={stopActionEvent}
                                                onPointerDown={stopActionEvent}
                                                onClick={(event) => {
                                                    event.preventDefault();
                                                    event.stopPropagation();
                                                    requestDeleteTemplates([row.id]);
                                                }}
                                            >
                                                <Trash2 size={14} />
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
                        <AlertCircle size={28} strokeWidth={1.4} className="opacity-60" />
                        <span className="text-small">No templates found.</span>
                    </div>
                )}
            </div>

            {/* Footer — loading indicator only */}
            {isLoading && (
                <div
                    className="flex items-center gap-2 border-t border-border px-3 py-1.5"
                    style={{ background: 'var(--card)' }}
                >
                    <Spinner size={12} />
                    <span className="text-label text-muted-foreground">Saving…</span>
                </div>
            )}

            <ConfirmationModal
                isOpen={showDeleteConfirm}
                onClose={() => {
                    setShowDeleteConfirm(false);
                    setPendingDeleteIds([]);
                }}
                onConfirm={() => {
                    void confirmDeleteTemplates();
                }}
                title="Delete Templates"
                message={`Delete ${pendingDeleteIds.length} selected ${pendingDeleteIds.length === 1 ? 'template' : 'templates'}?`}
                description="This action cannot be undone."
                confirmLabel="Delete"
                variant="destructive"
            />
        </div>
    );
};
