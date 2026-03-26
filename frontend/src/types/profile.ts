import type { ToastPlacement } from '../components/layout/Toast';
import type { CommandId } from '../lib/shortcutRegistry';

export interface ProfileMetadata {
    name: string;
    description?: string;
    exported_at: string;
}

export interface ProfileSettings {
    theme: string;
    font_size: number;
    default_limit: number;
    toast_placement: ToastPlacement;
    connect_timeout: number;
    query_timeout: number;
    auto_check_updates: boolean;
    view_mode: boolean;
}

export interface ProfileLayout {
    show_sidebar: boolean;
    show_result_panel: boolean;
    show_right_sidebar: boolean;
}

export interface ZentroProfilePackageV1 {
    schema: 'zentro.profile';
    version: 1;
    metadata: ProfileMetadata;
    settings: ProfileSettings;
    layout: ProfileLayout;
    shortcuts: Record<CommandId, string>;
}
