import type React from 'react';

export interface UiAction {
    id: string;
    icon?: React.ReactNode;
    label?: string;
    title?: string;
    onClick?: () => void | Promise<void>;
    disabled?: boolean;
    loading?: boolean;
    danger?: boolean;
    render?: () => React.ReactNode;
    signature?: string;
}
