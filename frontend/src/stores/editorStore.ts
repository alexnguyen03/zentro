import { create } from 'zustand';

export interface Tab {
    id: string;
    name: string;
    query: string;
    isRunning: boolean;
}

interface EditorState {
    tabs: Tab[];
    activeTabId: string | null;

    addTab: (tabInit?: Partial<Tab>) => string;
    removeTab: (id: string) => void;
    setActiveTabId: (id: string) => void;
    updateTabQuery: (id: string, query: string) => void;
    setTabRunning: (id: string, isRunning: boolean) => void;
    renameTab: (id: string, newName: string) => void;
    setTabQuery: (id: string, query: string) => void;
}

export const useEditorStore = create<EditorState>((set) => ({
    tabs: [],
    activeTabId: null,

    addTab: (tabInit) => {
        const id = tabInit?.id || crypto.randomUUID();
        let name = tabInit?.name || 'New Query';

        set((state) => {
            // Auto increment name like "New Query 2"
            if (!tabInit?.name) {
                let count = 1;
                let checkName = name;
                while (state.tabs.some(t => t.name === checkName)) {
                    count++;
                    checkName = `New Query ${count}`;
                }
                name = checkName;
            }

            const newTab: Tab = {
                id,
                name,
                query: tabInit?.query || '',
                isRunning: false,
                ...tabInit
            };

            return {
                tabs: [...state.tabs, newTab],
                activeTabId: id,
            };
        });
        return id;
    },

    removeTab: (id) => set((state) => {
        const newTabs = state.tabs.filter(t => t.id !== id);
        let newActiveId = state.activeTabId;
        if (newActiveId === id) {
            newActiveId = newTabs.length > 0 ? newTabs[newTabs.length - 1].id : null;
        }
        return { tabs: newTabs, activeTabId: newActiveId };
    }),

    setActiveTabId: (id) => set({ activeTabId: id }),

    updateTabQuery: (id, query) => set((state) => ({
        tabs: state.tabs.map(t => t.id === id ? { ...t, query } : t)
    })),

    setTabRunning: (id, isRunning) => set((state) => ({
        tabs: state.tabs.map(t => t.id === id ? { ...t, isRunning } : t)
    })),

    renameTab: (id, newName) => set((state) => ({
        tabs: state.tabs.map(t => t.id === id ? { ...t, name: newName } : t)
    })),

    setTabQuery: (id, query) => set((state) => ({
        tabs: state.tabs.map(t => t.id === id ? { ...t, query } : t)
    })),
}));
