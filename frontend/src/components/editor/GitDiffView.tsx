import React from 'react';
import { DiffEditor } from '@monaco-editor/react';
import { useSettingsStore } from '../../stores/settingsStore';
import type { Tab } from '../../stores/editorStore';

interface GitDiffViewProps {
    tab: Tab;
}

export const GitDiffView: React.FC<GitDiffViewProps> = ({ tab }) => {
    const { theme } = useSettingsStore();
    const monacoTheme = theme === 'dark' ? 'vs-dark' : theme === 'light' ? 'vs' : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'vs-dark' : 'vs');

    return (
        <DiffEditor
            original={tab.gitDiffBefore ?? ''}
            modified={tab.gitDiffAfter ?? ''}
            language="sql"
            theme={monacoTheme}
            options={{
                readOnly: true,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                automaticLayout: true,
                fontSize: 13,
                renderOverviewRuler: false,
                renderSideBySide: true,
            }}
        />
    );
};
