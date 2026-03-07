import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface LayoutState {
    showSidebar: boolean;
    showResultPanel: boolean;
    showRightSidebar: boolean;

    toggleSidebar: () => void;
    toggleResultPanel: () => void;
    toggleRightSidebar: () => void;

    setShowSidebar: (show: boolean) => void;
    setShowResultPanel: (show: boolean) => void;
    setShowRightSidebar: (show: boolean) => void;
}

export const useLayoutStore = create<LayoutState>()(
    persist(
        (set) => ({
            showSidebar: true,
            showResultPanel: true,
            showRightSidebar: false,

            toggleSidebar: () => set((state) => ({ showSidebar: !state.showSidebar })),
            toggleResultPanel: () => set((state) => ({ showResultPanel: !state.showResultPanel })),
            toggleRightSidebar: () => set((state) => ({ showRightSidebar: !state.showRightSidebar })),

            setShowSidebar: (show) => set({ showSidebar: show }),
            setShowResultPanel: (show) => set({ showResultPanel: show }),
            setShowRightSidebar: (show) => set({ showRightSidebar: show }),
        }),
        {
            name: 'zentro-layout-storage',
            partialize: (state) => ({
                showSidebar: state.showSidebar,
                showResultPanel: state.showResultPanel,
                showRightSidebar: state.showRightSidebar,
            }),
        }
    )
);
