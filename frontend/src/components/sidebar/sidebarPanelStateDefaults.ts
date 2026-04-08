export const EXPLORER_PANEL_STATE_DEFAULT = {
    filter: '',
    fuzzyMatch: false,
    activeCategoryKey: 'tables',
    selectedSchema: '__all_schemas__',
    showMoreCategories: false,
};

export const HISTORY_PANEL_STATE_DEFAULT = {
    search: '',
};

export const SCRIPTS_PANEL_STATE_DEFAULT = {
    search: '',
};

export const TIMELINE_PANEL_STATE_DEFAULT = {
    eventTypeFilter: '',
    objectFilter: '',
    schemaFilter: '',
    fromDate: '',
    toDate: '',
    selectedHash: '',
};

export const BOOKMARK_PANEL_STATE_DEFAULT = {
    scope: 'current' as 'current' | 'global',
    collapsedKeys: {} as Record<string, boolean>,
};

export const SOURCE_CONTROL_PANEL_STATE_DEFAULT = {
    search: '',
};

export const ROW_DETAIL_PANEL_STATE_DEFAULT = {
    viewMode: 'form' as 'form' | 'json',
    isSelectMode: false,
};
