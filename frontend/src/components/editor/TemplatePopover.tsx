import React, { useState, useEffect, useRef } from 'react';
import { Plus, X, Trash2, Search, CheckCircle2, AlertCircle } from 'lucide-react';
import { useTemplateStore } from '../../stores/templateStore';
import { models } from '../../../wailsjs/go/models';
import { Button, Spinner } from '../ui';
import { cn } from '../../lib/cn';

type Template = models.Template;

interface TemplatePopoverProps {
    onClose: () => void;
    anchorRect: DOMRect | null;
}

export const TemplatePopover: React.FC<TemplatePopoverProps> = ({ onClose, anchorRect }) => {
    const { templates, saveTemplate, deleteTemplate, isLoading } = useTemplateStore();
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [filter, setFilter] = useState('');
    const [draftTemplates, setDraftTemplates] = useState<Template[]>([]);
    const [focusNewlyAdded, setFocusNewlyAdded] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const prevTemplatesCount = useRef(templates.length);

    // Sync draft with store when store changes externally
    useEffect(() => {
        setDraftTemplates(templates);
        
        // Check if we just added a new one
        if (focusNewlyAdded && templates.length > prevTemplatesCount.current) {
            // Assume the new one is the last one added to the list
            const newTemplate = templates[templates.length - 1];
            if (newTemplate) {
                // Small timeout to ensure DOM is updated
                setTimeout(() => {
                    const input = document.querySelector(`input[data-name-id="${newTemplate.id}"]`) as HTMLInputElement;
                    if (input) {
                        input.focus();
                        input.select();
                    }
                }, 10);
            }
            setFocusNewlyAdded(false);
        }
        prevTemplatesCount.current = templates.length;
    }, [templates, focusNewlyAdded]);

    // Filter templates from draft
    const filteredTemplates = draftTemplates.filter(t => 
        t.name.toLowerCase().includes(filter.toLowerCase()) || 
        t.trigger.toLowerCase().includes(filter.toLowerCase())
    );

    // Handle outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    // Handle global keys (Delete for removal, Escape for close)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Escape to close - always works
            if (e.key === 'Escape') {
                onClose();
                return;
            }

            // Delete to remove - only when not typing
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
            
            if (e.key === 'Delete' && selectedIds.size > 0) {
                if (confirm(`Are you sure you want to delete ${selectedIds.size} templates?`)) {
                    const idsToDelete = Array.from(selectedIds);
                    setSelectedIds(new Set());
                    setDraftTemplates(prev => prev.filter(t => !selectedIds.has(t.id)));
                    
                    // Fire and forget deletions to keep UX snappy
                    idsToDelete.forEach(id => deleteTemplate(id));
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedIds, deleteTemplate, onClose]);

    const handleAdd = async () => {
        const newTemplate: Template = {
            id: '', 
            name: 'New Template',
            trigger: 'abbr',
            content: 'SELECT * FROM table;'
        };
        setFocusNewlyAdded(true);
        await saveTemplate(newTemplate);
    };

    const handleDraftUpdate = (id: string, field: keyof Template, value: string) => {
        setDraftTemplates(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t));
    };

    const handleBlur = async (id: string, field: keyof Template, value: string) => {
        const original = templates.find(t => t.id === id);
        if (original && original[field] === value) return;
        
        const current = draftTemplates.find(t => t.id === id);
        if (current) {
            await saveTemplate(current);
        }
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

    // Calculate position
    const style: React.CSSProperties = {
        position: 'fixed',
        bottom: '40px', 
        right: '10px',
    };

    return (
        <div 
            ref={containerRef}
            style={style}
            className="z-popover flex h-[400px] w-[600px] flex-col overflow-hidden rounded-xl border border-border bg-bg-secondary shadow-2xl animate-in slide-in-from-bottom-2 duration-200"
        >
            {/* Header */}
            <div className="px-4 py-3 border-b border-border bg-bg-tertiary/30 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <h3 className="text-xs font-bold text-text-primary tracking-tight">MANAGE TEMPLATES</h3>
                    <span className="text-[10px] text-text-muted bg-bg-primary px-1.5 py-0.5 rounded border border-border">
                        {templates.length} total
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-text-muted" size={12} />
                        <input 
                            className="bg-bg-primary border border-border rounded px-7 py-1 text-[11px] outline-none focus:border-success/50 transition-colors w-40"
                            placeholder="Filter..."
                            value={filter}
                            onChange={e => setFilter(e.target.value)}
                        />
                    </div>
                    <Button variant="success" size="sm" className="h-7 text-[10px] px-2" onClick={handleAdd}>
                        <Plus size={12} className="mr-1" /> Add
                    </Button>
                    <Button variant="ghost" size="icon" onClick={onClose} className="w-7 h-7">
                        <X size={14} />
                    </Button>
                </div>
            </div>

            {/* Table Header */}
            <div className="grid grid-cols-[40px_1fr_100px_2fr] border-b border-border bg-bg-tertiary/10 text-[10px] font-bold text-text-muted uppercase tracking-wider">
                <div className="px-3 py-2 border-r border-border flex items-center justify-center">#</div>
                <div className="px-3 py-2 border-r border-border">Name</div>
                <div className="px-3 py-2 border-r border-border">Shortcut</div>
                <div className="px-3 py-2">SQL Content</div>
            </div>

            {/* Table Body */}
            <div className="flex-1 overflow-y-auto no-scrollbar">
                {filteredTemplates.map((t, idx) => {
                    const isSelected = selectedIds.has(t.id);
                    return (
                        <div 
                            key={t.id}
                            onClick={(e) => toggleSelect(t.id, (e.ctrlKey || e.metaKey || e.shiftKey))}
                            className={cn(
                                "grid grid-cols-[40px_1fr_100px_2fr] border-b border-border/50 text-[12px] group transition-colors",
                                isSelected ? "bg-success/10" : "hover:bg-bg-tertiary/50"
                            )}
                        >
                            <div className="px-3 py-2 border-r border-border/5 text-[10px] text-text-muted flex items-center justify-center font-mono">
                                {idx + 1}
                            </div>
                            <div className="px-3 py-2 border-r border-border/5 overflow-hidden">
                                <input 
                                    data-name-id={t.id}
                                    className="bg-transparent border-none outline-none text-text-primary w-full truncate focus:text-success focus:bg-success/5 px-1 -mx-1 rounded transition-colors"
                                    value={t.name}
                                    onBlur={(e) => handleBlur(t.id, 'name', e.target.value)}
                                    onChange={(e) => handleDraftUpdate(t.id, 'name', e.target.value)}
                                />
                            </div>
                            <div className="px-3 py-2 border-r border-border/5 overflow-hidden font-mono text-warning">
                                <input 
                                    className="bg-transparent border-none outline-none text-warning w-full truncate focus:bg-warning/5 px-1 -mx-1 rounded transition-colors"
                                    value={t.trigger}
                                    onBlur={(e) => handleBlur(t.id, 'trigger', e.target.value)}
                                    onChange={(e) => handleDraftUpdate(t.id, 'trigger', e.target.value)}
                                />
                            </div>
                            <div className="px-3 py-2 overflow-hidden text-text-muted group-hover:text-text-secondary">
                                <input 
                                    className="bg-transparent border-none outline-none w-full truncate font-mono text-[11px] focus:text-text-primary focus:bg-bg-tertiary px-1 -mx-1 rounded transition-colors"
                                    value={t.content}
                                    onBlur={(e) => handleBlur(t.id, 'content', e.target.value)}
                                    onChange={(e) => handleDraftUpdate(t.id, 'content', e.target.value)}
                                />
                            </div>
                        </div>
                    );
                })}
                {filteredTemplates.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-text-muted opacity-50 space-y-2">
                        <AlertCircle size={32} strokeWidth={1} />
                        <span className="text-xs italic">No templates found</span>
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="px-4 py-2 border-t border-border bg-bg-tertiary/20 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3 text-[10px] text-text-muted">
                    <span className="flex items-center gap-1">
                        <kbd className="px-1 bg-bg-tertiary rounded border border-border/50 text-[9px]">Ctrl</kbd> Select
                    </span>
                    <span className="flex items-center gap-1">
                        <kbd className="px-1 bg-bg-tertiary rounded border border-border/50 text-[9px]">Del</kbd> Delete
                    </span>
                    {isLoading && (
                        <span className="flex items-center gap-1 text-success animate-pulse">
                            <Spinner size={8} /> saving...
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    {selectedIds.size > 0 && (
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-success animate-in fade-in slide-in-from-right-2">
                                {selectedIds.size} selected
                            </span>
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-6 text-[10px] text-error hover:bg-error/10 px-2"
                                onClick={async () => {
                                    if (confirm(`Delete ${selectedIds.size} templates?`)) {
                                        const ids = Array.from(selectedIds);
                                        setSelectedIds(new Set());
                                        for (const id of ids) await deleteTemplate(id);
                                    }
                                }}
                            >
                                <Trash2 size={12} className="mr-1" /> Delete
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
