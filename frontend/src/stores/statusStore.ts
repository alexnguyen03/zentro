import { create } from 'zustand';

interface StatusState {
    connectionLabel: string;
    status: 'disconnected' | 'connecting' | 'connected' | 'error';
    rowCount: number;
    duration: number;

    setConnectionLabel: (label: string) => void;
    setStatus: (status: StatusState['status']) => void;
    setQueryStats: (rowCount: number, duration: number) => void;
}

export const useStatusStore = create<StatusState>((set) => ({
    connectionLabel: 'No Connection',
    status: 'disconnected',
    rowCount: 0,
    duration: 0,

    setConnectionLabel: (label) => set({ connectionLabel: label }),
    setStatus: (status) => set({ status }),
    setQueryStats: (rowCount, duration) => set({ rowCount, duration }),
}));
