export type ComponentTone = 'default' | 'neutral' | 'success' | 'warning' | 'danger';
export type ComponentState = 'default' | 'loading' | 'error' | 'disabled';
export type ComponentDensity = 'compact' | 'comfortable' | 'spacious';

// Shared size token for all form controls (Input, Select, Button)
// sm = --control-height-sm (28px compact) — toolbar, sidebar, inline, default
// md = --control-height-md (36px compact) — prominent form fields
export type ControlSize = 'sm' | 'md';

export const CONTROL_SIZE_CLASS: Record<ControlSize, string> = {
    sm: '[height:var(--control-height-sm)] [padding-left:var(--control-px-sm)] [padding-right:var(--control-px-sm)] text-small',
    md: '[height:var(--control-height-md)] [padding-left:var(--control-px-md)] [padding-right:var(--control-px-md)] text-small',
};

export interface DesignSystemControlProps {
    tone?: ComponentTone;
    state?: ComponentState;
    density?: ComponentDensity;
}

// Density is applied via data-density attribute on :root — no per-component class needed.
// This type is exposed so settings UI can reference valid density values.
export const DENSITY_CLASS: Record<ComponentDensity, string> = {
    compact: '',
    comfortable: '',
    spacious: '',
};

export const TONE_CLASS: Record<ComponentTone, string> = {
    default: '',
    neutral: '',
    success: 'data-[tone=success]:border-success/55 data-[tone=success]:text-success data-[ui-tone=success]:border-success/55 data-[ui-tone=success]:text-success',
    warning: 'data-[tone=warning]:border-warning/55 data-[tone=warning]:text-warning data-[ui-tone=warning]:border-warning/55 data-[ui-tone=warning]:text-warning',
    danger: 'data-[tone=danger]:border-destructive/55 data-[tone=danger]:text-destructive data-[ui-tone=danger]:border-destructive/55 data-[ui-tone=danger]:text-destructive',
};

export const STATE_CLASS: Record<ComponentState, string> = {
    default: '',
    loading: 'data-[state=loading]:pointer-events-none data-[state=loading]:opacity-80 data-[ui-state=loading]:pointer-events-none data-[ui-state=loading]:opacity-80',
    error: 'data-[state=error]:border-destructive data-[state=error]:ring-1 data-[state=error]:ring-destructive/30 data-[ui-state=error]:border-destructive data-[ui-state=error]:ring-1 data-[ui-state=error]:ring-destructive/30',
    disabled: 'data-[state=disabled]:pointer-events-none data-[state=disabled]:opacity-50 data-[ui-state=disabled]:pointer-events-none data-[ui-state=disabled]:opacity-50',
};
