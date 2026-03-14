import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface LayoutState {
    showSidebar: boolean;
    showResultPanel: boolean;
    showRightSidebar: boolean;
    showCommandPalette: boolean;

    toggleSidebar: () => void;
    toggleResultPanel: () => void;
    toggleRightSidebar: () => void;
    toggleCommandPalette: () => void;

    setShowSidebar: (show: boolean) => void;
    setShowResultPanel: (show: boolean) => void;
    setShowRightSidebar: (show: boolean) => void;
    setShowCommandPalette: (show: boolean) => void;
}

export const useLayoutStore = create<LayoutState>()(
    persist(
        (set) => ({
            showSidebar: true,
            showResultPanel: true,
            showRightSidebar: false,
            showCommandPalette: false,

            toggleSidebar: () => set((state) => ({ showSidebar: !state.showSidebar })),
            toggleResultPanel: () => set((state) => ({ showResultPanel: !state.showResultPanel })),
            toggleRightSidebar: () => set((state) => ({ showRightSidebar: !state.showRightSidebar })),
            toggleCommandPalette: () => set((state) => ({ showCommandPalette: !state.showCommandPalette })),

            setShowSidebar: (show) => set({ showSidebar: show }),
            setShowResultPanel: (show) => set({ showResultPanel: show }),
            setShowRightSidebar: (show) => set({ showRightSidebar: show }),
            setShowCommandPalette: (show) => set({ showCommandPalette: show }),
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
