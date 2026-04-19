import * as React from 'react';

import { cn } from '@/lib/cn';

type TableContextValue = {
    stickyHeader: boolean;
    stickyHeaderClassName?: string;
    stickyHeaderOffset: number;
};

const TableContext = React.createContext<TableContextValue>({
    stickyHeader: false,
    stickyHeaderClassName: undefined,
    stickyHeaderOffset: 0,
});

interface TableProps extends React.HTMLAttributes<HTMLTableElement> {
    containerClassName?: string;
    disableContainerScroll?: boolean;
    stickyHeader?: boolean;
    stickyHeaderClassName?: string;
    stickyHeaderOffset?: number;
}

const Table = React.forwardRef<HTMLTableElement, TableProps>(
    (
        {
            className,
            containerClassName,
            disableContainerScroll = false,
            stickyHeader = false,
            stickyHeaderClassName,
            stickyHeaderOffset = 0,
            ...props
        },
        ref,
    ) => (
        <TableContext.Provider value={{ stickyHeader, stickyHeaderClassName, stickyHeaderOffset }}>
            <div className={cn('relative w-full', disableContainerScroll ? 'overflow-visible' : 'overflow-auto', containerClassName)}>
                <table
                    ref={ref}
                    className={cn('w-full caption-bottom text-sm', className)}
                    {...props}
                />
            </div>
        </TableContext.Provider>
    ),
);
Table.displayName = 'Table';

const TableHeader = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
    ({ className, ...props }, ref) => (
        <thead ref={ref} className={cn('[&_tr]:border-b', className)} {...props} />
    ),
);
TableHeader.displayName = 'TableHeader';

const TableBody = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
    ({ className, ...props }, ref) => (
        <tbody
            ref={ref}
            className={cn('[&_tr:last-child]:border-0', className)}
            {...props}
        />
    ),
);
TableBody.displayName = 'TableBody';

const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
    ({ className, ...props }, ref) => (
        <tr
            ref={ref}
            className={cn(
                'border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted',
                className,
            )}
            {...props}
        />
    ),
);
TableRow.displayName = 'TableRow';

const TableHead = React.forwardRef<HTMLTableCellElement, React.ThHTMLAttributes<HTMLTableCellElement>>(
    ({ className, style, ...props }, ref) => {
        const { stickyHeader, stickyHeaderClassName, stickyHeaderOffset } = React.useContext(TableContext);
        return (
            <th
                ref={ref}
                style={stickyHeader ? { ...style, top: stickyHeaderOffset } : style}
                className={cn(
                    'h-6 px-2 align-middle text-left font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0',
                    stickyHeader && 'sticky z-10 border-b border-border bg-muted/90 backdrop-blur-sm',
                    stickyHeader && stickyHeaderClassName,
                    className,
                )}
                {...props}
            />
        );
    },
);
TableHead.displayName = 'TableHead';

const TableCell = React.forwardRef<HTMLTableCellElement, React.TdHTMLAttributes<HTMLTableCellElement>>(
    ({ className, ...props }, ref) => (
        <td
            ref={ref}
            className={cn('p-2 align-middle [&:has([role=checkbox])]:pr-0', className)}
            {...props}
        />
    ),
);
TableCell.displayName = 'TableCell';

const TableCaption = React.forwardRef<HTMLTableCaptionElement, React.HTMLAttributes<HTMLTableCaptionElement>>(
    ({ className, ...props }, ref) => (
        <caption
            ref={ref}
            className={cn('mt-4 text-sm text-muted-foreground', className)}
            {...props}
        />
    ),
);
TableCaption.displayName = 'TableCaption';

export {
    Table,
    TableHeader,
    TableBody,
    TableRow,
    TableHead,
    TableCell,
    TableCaption,
};
