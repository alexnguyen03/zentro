import React, { useState, useEffect, useRef } from 'react';
import { BookDashed, AlignJustify } from 'lucide-react';
import { Button } from '../ui';
import { useTemplateStore } from '../../stores/templateStore';
import { cn } from '../../lib/cn';
import { TemplatePopover } from './TemplatePopover';
import { models } from '../../../wailsjs/go/models';
import { DOM_EVENT } from '../../lib/constants';

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

    return (
        <div className="h-10 flex items-center justify-end shrink-0 select-none px-3">
            <div className="flex items-center gap-1 pl-4">
                <Button
                    variant="ghost"
                    size="icon"
                    className="hover:text-success"
                    title="Format Query (Ctrl+Shift+F)"
                    onClick={() => {
                        if (!isActive) return;
                        window.dispatchEvent(new CustomEvent(DOM_EVENT.FORMAT_QUERY_ACTION));
                    }}
                >
                    <AlignJustify size={14} />
                </Button>
                <Button
                    ref={plusBtnRef}
                    variant="ghost"
                    size="icon"
                    className={cn(
                        "hover:text-success",
                        showPopover && "bg-success/20 text-success"
                    )}
                    onClick={() => setShowPopover(!showPopover)}
                    title="Manage Templates"
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
