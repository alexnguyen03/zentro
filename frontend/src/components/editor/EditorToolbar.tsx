import React, { useState, useEffect, useRef } from 'react';
import { BookDashed, Settings, Sparkles } from 'lucide-react';
import { Button } from '../ui';
import { useTemplateStore } from '../../stores/templateStore';
import { cn } from '../../lib/cn';
import { TemplatePopover } from './TemplatePopover';
import { models } from '../../../wailsjs/go/models';

type Template = models.Template;

interface EditorToolbarProps {
    isActive?: boolean;
}

export const EditorToolbar: React.FC<EditorToolbarProps> = ({ isActive }) => {
    const { loadTemplates } = useTemplateStore();
    const [showPopover, setShowPopover] = useState(false);
    const plusBtnRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        loadTemplates();
    }, []);

    // Global shortcut Alt + Shift + T
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.altKey && e.shiftKey && (e.key === 'T' || e.key === 't')) {
                if (isActive) {
                    e.preventDefault();
                    setShowPopover(prev => !prev);
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isActive]);

    return (
        <div className="h-10 flex items-center justify-end shrink-0 select-none px-3">
            <div className="flex items-center gap-1 pl-4">
                <Button
                    ref={plusBtnRef}
                    variant="ghost"
                    size="icon"
                    className={cn(
                        "hover:text-success",
                        showPopover && "bg-success/20 text-success"
                    )}
                    onClick={() => setShowPopover(!showPopover)}
                    title="Manage Templates (Alt+Shift+T)"
                >
                    <BookDashed size={14} />
                </Button>
            </div>

            {showPopover && (
                <TemplatePopover
                    onClose={() => setShowPopover(false)}
                    anchorRect={plusBtnRef.current?.getBoundingClientRect() || null}
                />
            )}
        </div>
    );
};
