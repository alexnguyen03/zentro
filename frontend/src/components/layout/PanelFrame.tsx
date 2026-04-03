import React from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/cn';
import { Button } from '../ui/Button';

interface PanelFrameProps {
    title: React.ReactNode;
    subtitle?: React.ReactNode;
    onClose?: () => void;
    closeTitle?: string;
    headerRight?: React.ReactNode;
    footer?: React.ReactNode;
    children: React.ReactNode;
    className?: string;
    headerClassName?: string;
    bodyClassName?: string;
    footerClassName?: string;
    titleClassName?: string;
    subtitleClassName?: string;
    style?: React.CSSProperties;
}

export const PanelFrame: React.FC<PanelFrameProps> = ({
    title,
    subtitle,
    onClose,
    closeTitle = 'Close',
    headerRight,
    footer,
    children,
    className,
    headerClassName,
    bodyClassName,
    footerClassName,
    titleClassName,
    subtitleClassName,
    style,
}) => {
    return (
        <section style={style} className={cn('flex h-full min-h-0 flex-col overflow-hidden bg-card text-card-foreground', className)}>
            <header className={cn('flex items-center justify-between gap-3 border-b border-border/25 px-4 py-3', headerClassName)}>
                <div className="min-w-0">
                    {subtitle && (
                        <div className={cn('text-[11px] font-semibold text-muted-foreground', subtitleClassName)}>
                            {subtitle}
                        </div>
                    )}
                    <h2 className={cn('m-0 mt-0.5 truncate text-[28px] font-bold tracking-tight text-foreground', titleClassName)}>
                        {title}
                    </h2>
                </div>
                <div className="ml-2 flex shrink-0 items-center gap-2">
                    {headerRight}
                    {onClose && (
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onClose}
                            title={closeTitle}
                            className="h-8 w-8 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                            <X size={16} />
                        </Button>
                    )}
                </div>
            </header>

            <div className={cn('min-h-0 flex-1', bodyClassName)}>
                {children}
            </div>

            {footer && (
                <footer className={cn('shrink-0 border-t border-border/25 px-4 py-3', footerClassName)}>
                    {footer}
                </footer>
            )}
        </section>
    );
};
