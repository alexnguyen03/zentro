import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { X, Save, Trash2 } from 'lucide-react';
import { cn } from '../../lib/cn';
import { Button, Spinner } from '../ui';
import { useTemplateStore } from '../../stores/templateStore';
import { models } from '../../../wailsjs/go/models';

type Template = models.Template;

const fi = 'bg-bg-primary border border-border text-text-primary px-3 py-2 rounded text-[13px] outline-none focus:border-success transition-colors w-full';
const lbl = 'text-[11px] text-text-secondary block mb-1 font-medium uppercase tracking-wider';

interface TemplateDialogProps {
    template?: Template;
    onClose: () => void;
}

export const TemplateDialog: React.FC<TemplateDialogProps> = ({ template, onClose }) => {
    const { saveTemplate, deleteTemplate, isLoading } = useTemplateStore();
    const [formData, setFormData] = useState<Template>(
        template || { id: '', name: '', trigger: '', content: '' }
    );

    const isEditing = !!template?.id;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name || !formData.trigger || !formData.content) return;
        await saveTemplate(formData);
        onClose();
    };

    const handleDelete = async () => {
        if (!template?.id) return;
        if (confirm('Are you sure you want to delete this template?')) {
            await deleteTemplate(template.id);
            onClose();
        }
    };

    return ReactDOM.createPortal(
        <div className="fixed inset-0 bg-black/50 z-10000 flex items-center justify-center animate-in fade-in duration-200">
            <div 
                className="bg-bg-secondary border border-border rounded-xl w-[500px] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-5 py-4 border-b border-border flex items-center justify-between bg-bg-tertiary/30">
                    <h2 className="text-[15px] font-bold text-text-primary">
                        {isEditing ? 'Edit Template' : 'Create New Template'}
                    </h2>
                    <Button variant="ghost" size="icon" onClick={onClose} className="w-8 h-8 rounded-full">
                        <X size={16} className="text-text-muted" />
                    </Button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-1">
                            <label className={lbl}>Name</label>
                            <input
                                autoFocus
                                required
                                className={fi}
                                placeholder="e.g. Select All"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                            />
                        </div>
                        <div className="col-span-1">
                            <label className={lbl}>Trigger (Abbreviation)</label>
                            <input
                                required
                                className={cn(fi, "font-mono")}
                                placeholder="e.g. slall"
                                value={formData.trigger}
                                onChange={e => setFormData({ ...formData, trigger: e.target.value })}
                            />
                        </div>
                    </div>

                    <div>
                        <label className={lbl}>SQL Content</label>
                        <textarea
                            required
                            rows={8}
                            className={cn(fi, "font-mono text-[12px] resize-none leading-relaxed")}
                            placeholder="SELECT * FROM ..."
                            value={formData.content}
                            onChange={e => setFormData({ ...formData, content: e.target.value })}
                        />
                    </div>

                    {/* Footer Actions */}
                    <div className="flex items-center justify-between mt-2 pt-4 border-t border-border">
                        {isEditing ? (
                            <Button 
                                type="button" 
                                variant="ghost" 
                                className="text-error hover:bg-error/10" 
                                onClick={handleDelete}
                                disabled={isLoading}
                            >
                                <Trash2 size={14} className="mr-2" />
                                Delete
                            </Button>
                        ) : <div />}

                        <div className="flex gap-2">
                            <Button type="button" variant="ghost" onClick={onClose}>
                                Cancel
                            </Button>
                            <Button type="submit" variant="success" className="px-6" disabled={isLoading}>
                                {isLoading ? (
                                    <><Spinner size={14} className="mr-2" /> Saving...</>
                                ) : (
                                    <><Save size={14} className="mr-2" /> Save Template</>
                                )}
                            </Button>
                        </div>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
};
