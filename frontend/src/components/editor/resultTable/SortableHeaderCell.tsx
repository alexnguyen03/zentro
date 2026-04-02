import React from 'react';
import { Header } from '@tanstack/react-table';
import { GripVertical } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { DisplayRow } from '../../../lib/dataEditing';

interface SortableHeaderCellProps {
    header: Header<DisplayRow, unknown>;
    className: string;
    title?: string;
    onSortToggle?: React.MouseEventHandler<HTMLTableHeaderCellElement>;
    onAutoFit?: () => void;
    children: React.ReactNode;
}

export const SortableHeaderCell: React.FC<SortableHeaderCellProps> = ({
    header,
    className,
    title,
    onSortToggle,
    onAutoFit,
    children,
}) => {
    const sortable = useSortable({ id: header.column.id });
    const style: React.CSSProperties = {
        width: header.getSize(),
        minWidth: header.getSize(),
        maxWidth: header.getSize(),
        transform: CSS.Transform.toString(sortable.transform),
        transition: sortable.transition,
        zIndex: sortable.isDragging ? 2 : 1,
    };

    return (
        <th
            ref={sortable.setNodeRef}
            style={style}
            className={className}
            onClick={onSortToggle}
            title={title}
        >
            {children}
            <span
                className="rt-th-drag-handle"
                title="Drag to reorder column"
                onClick={(event) => event.stopPropagation()}
                {...sortable.attributes}
                {...sortable.listeners}
            >
                <GripVertical size={11} />
            </span>
            <div
                className="rt-col-resizer"
                onMouseDown={header.getResizeHandler()}
                onTouchStart={header.getResizeHandler()}
                onClick={(event) => event.stopPropagation()}
                onDoubleClick={(event) => {
                    event.stopPropagation();
                    event.preventDefault();
                    onAutoFit?.();
                }}
            />
        </th>
    );
};
