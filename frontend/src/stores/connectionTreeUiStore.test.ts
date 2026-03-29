import { beforeEach, describe, expect, it } from 'vitest';
import { useConnectionTreeUiStore } from './connectionTreeUiStore';

const TREE_KEY = 'profile:db:postgres';

describe('connectionTreeUiStore', () => {
    beforeEach(() => {
        useConnectionTreeUiStore.setState({ treeStateByKey: {} });
        (useConnectionTreeUiStore as unknown as { persist?: { clearStorage?: () => void } }).persist?.clearStorage?.();
    });

    it('applies default expanded category only once', () => {
        const store = useConnectionTreeUiStore.getState();
        store.ensureDefaults(TREE_KEY, 'tables');

        let state = useConnectionTreeUiStore.getState().treeStateByKey[TREE_KEY];
        expect(state.defaultsApplied).toBe(true);
        expect(state.expandedCategories).toContain('tables');

        store.toggleCategory(TREE_KEY, 'views');
        store.ensureDefaults(TREE_KEY, 'tables');

        state = useConnectionTreeUiStore.getState().treeStateByKey[TREE_KEY];
        expect(state.expandedCategories).toContain('views');
    });

    it('toggles schema expansion per category', () => {
        const store = useConnectionTreeUiStore.getState();
        store.ensureDefaults(TREE_KEY, 'tables');

        store.toggleSchema(TREE_KEY, 'tables', 'public');
        let state = useConnectionTreeUiStore.getState().treeStateByKey[TREE_KEY];
        expect(state.expandedSchemasByCategory.tables).toEqual(['public']);

        store.toggleSchema(TREE_KEY, 'tables', 'public');
        state = useConnectionTreeUiStore.getState().treeStateByKey[TREE_KEY];
        expect(state.expandedSchemasByCategory.tables).toEqual([]);
    });
});
