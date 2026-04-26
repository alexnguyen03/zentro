import { useEnvironmentStore } from '../../stores/environmentStore';
import { useProjectStore } from '../../stores/projectStore';
import type { EnvironmentKey } from '../../types/project';

export const SQL_COMPLETION_TABLE_SELECTED_COMMAND_ID = 'zentro.sql.completion.tableSelected';

type SqlCompletionSchemaPayload = {
    schemaName?: string;
};

type DisposableLike = {
    dispose: () => void;
};

type SqlSuggestionMonacoApi = {
    editor: {
        registerCommand: (id: string, handler: (accessor: unknown, ...args: unknown[]) => void) => DisposableLike;
    };
};

const DISPOSABLE_KEY = '__ZENTRO_SQL_COMPLETION_SCHEMA_COMMAND__';
type SqlSuggestionWindow = Window & { [DISPOSABLE_KEY]?: DisposableLike };

function getStoredDisposable() {
    return (window as SqlSuggestionWindow)[DISPOSABLE_KEY];
}

function setStoredDisposable(disposable?: DisposableLike) {
    (window as SqlSuggestionWindow)[DISPOSABLE_KEY] = disposable;
}

export function registerSqlCompletionSchemaContextCommand(monaco: SqlSuggestionMonacoApi) {
    if (getStoredDisposable()) return;

    const disposable = monaco.editor.registerCommand(
        SQL_COMPLETION_TABLE_SELECTED_COMMAND_ID,
        (_accessor, ...args) => {
            const payload = (args[0] && typeof args[0] === 'object') ? (args[0] as SqlCompletionSchemaPayload) : undefined;
            const schemaName = (typeof payload?.schemaName === 'string' ? payload.schemaName : '').trim();
            if (!schemaName) return;

            const projectStore = useProjectStore.getState();
            const activeProject = projectStore.activeProject;
            if (!activeProject) return;

            const activeEnvironmentKey = useEnvironmentStore.getState().activeEnvironmentKey
                || activeProject.default_environment_key;
            if (!activeEnvironmentKey) return;

            void projectStore.setEnvironmentLastSchema(activeEnvironmentKey as EnvironmentKey, schemaName);
        },
    );

    setStoredDisposable(disposable);
}
