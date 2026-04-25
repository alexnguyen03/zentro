import * as React from 'react';
import { cn } from '@/lib/cn';

type StateTone = 'empty' | 'loading' | 'error';

interface AppShellPatternProps {
    header: React.ReactNode;
    sidebar?: React.ReactNode;
    children: React.ReactNode;
    className?: string;
    bodyClassName?: string;
    contentClassName?: string;
}

interface FormSectionPatternProps {
    title: string;
    description?: string;
    children: React.ReactNode;
    actions?: React.ReactNode;
    className?: string;
}

interface StatePanelProps {
    tone: StateTone;
    title: string;
    description?: string;
    action?: React.ReactNode;
    className?: string;
}

interface PanelProps {
    children: React.ReactNode;
    className?: string;
    role?: React.AriaRole;
}

interface ActionBarProps {
    children: React.ReactNode;
    className?: string;
}

export function AppShell({
    header,
    sidebar,
    children,
    className,
    bodyClassName,
    contentClassName,
}: AppShellPatternProps) {
    const bodyStyle: React.CSSProperties | undefined = sidebar
        ? undefined
        : { gridTemplateColumns: 'minmax(0, 1fr)' };

    return (
        <section className={cn('ui-shell', className)}>
            <header className="ui-shell-header">{header}</header>
            <div className={cn('ui-shell-body', bodyClassName)} style={bodyStyle}>
                {sidebar ? <aside className="ui-panel">{sidebar}</aside> : null}
                <main className={cn('ui-panel ui-content-region', contentClassName)}>{children}</main>
            </div>
        </section>
    );
}

export function Panel({ children, className, role }: PanelProps) {
    return (
        <section role={role} className={cn('ui-panel', className)}>
            {children}
        </section>
    );
}

export function FormSection({
    title,
    description,
    children,
    actions,
    className,
}: FormSectionPatternProps) {
    return (
        <section className={cn('ui-panel ui-form', className)}>
            <div className="ui-form-row">
                <h2 className="ui-text-section">{title}</h2>
                {description ? <p className="ui-text-caption text-muted-foreground">{description}</p> : null}
            </div>
            <div className="ui-form">{children}</div>
            {actions ? <ActionBar>{actions}</ActionBar> : null}
        </section>
    );
}

export function ActionBar({ children, className }: ActionBarProps) {
    return <div className={cn('ui-form-actions', className)}>{children}</div>;
}

export function StatePanel({
    tone,
    title,
    description,
    action,
    className,
}: StatePanelProps) {
    const toneClassName =
        tone === 'error'
            ? 'ui-error-state'
            : tone === 'loading'
                ? 'ui-loading-state'
                : 'ui-empty-state';

    return (
        <section className={cn(toneClassName, className)} role={tone === 'error' ? 'alert' : 'status'}>
            <div className="ui-form-row">
                <h3 className="ui-text-section">{title}</h3>
                {description ? <p className="ui-text-body text-muted-foreground">{description}</p> : null}
                {action}
            </div>
        </section>
    );
}

export function DataEmpty(props: Omit<StatePanelProps, 'tone'>) {
    return <StatePanel tone="empty" {...props} />;
}

export function DataLoading(props: Omit<StatePanelProps, 'tone'>) {
    return <StatePanel tone="loading" {...props} />;
}

export function DataError(props: Omit<StatePanelProps, 'tone'>) {
    return <StatePanel tone="error" {...props} />;
}

// Backward-compatible aliases for existing usage.
export const AppShellPattern = AppShell;
export const FormSectionPattern = FormSection;
