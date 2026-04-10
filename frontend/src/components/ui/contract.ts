export type ComponentTone = 'default' | 'neutral' | 'success' | 'warning' | 'danger';
export type ComponentState = 'default' | 'loading' | 'error' | 'disabled';
export type ComponentDensity = 'compact';

export interface DesignSystemControlProps {
    tone?: ComponentTone;
    state?: ComponentState;
    density?: ComponentDensity;
}

export const DENSITY_CLASS: Record<ComponentDensity, string> = {
    compact: 'text-body',
};

export const TONE_CLASS: Record<ComponentTone, string> = {
    default: '',
    neutral: '',
    success: 'data-[tone=success]:border-success/55 data-[tone=success]:text-success',
    warning: 'data-[tone=warning]:border-warning/55 data-[tone=warning]:text-warning',
    danger: 'data-[tone=danger]:border-destructive/55 data-[tone=danger]:text-destructive',
};

export const STATE_CLASS: Record<ComponentState, string> = {
    default: '',
    loading: 'data-[state=loading]:pointer-events-none data-[state=loading]:opacity-80',
    error: 'data-[state=error]:border-destructive data-[state=error]:ring-1 data-[state=error]:ring-destructive/30',
    disabled: 'data-[state=disabled]:pointer-events-none data-[state=disabled]:opacity-50',
};

