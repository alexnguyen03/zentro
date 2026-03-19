import { create } from 'zustand';

interface StatusState {
    connectionLabel: string;
    status: 'disconnected' | 'connecting' | 'connected' | 'error';
    rowCount: number;
    duration: number;
    message: string | null;
    currentDriver: string;
    transactionStatus: 'none' | 'active' | 'error';
    transactionError: string | null;

    setConnectionLabel: (label: string) => void;
    setStatus: (status: StatusState['status']) => void;
    setQueryStats: (rowCount: number, duration: number) => void;
    setMessage: (message: string | null) => void;
    setCurrentDriver: (driver: string) => void;
    setTransactionStatus: (status: StatusState['transactionStatus'], error?: string | null) => void;
}

export const useStatusStore = create<StatusState>((set) => ({
    connectionLabel: 'No Connection',
    status: 'disconnected',
    rowCount: 0,
    duration: 0,
    message: null,
    currentDriver: '',
    transactionStatus: 'none',
    transactionError: null,

    setConnectionLabel: (label) => set({ connectionLabel: label }),
    setStatus: (status) => set({ status }),
    setQueryStats: (rowCount, duration) => set({ rowCount, duration }),
    setMessage: (message) => set({ message }),
    setCurrentDriver: (driver) => set({ currentDriver: driver }),
    setTransactionStatus: (transactionStatus, transactionError = null) => set({ transactionStatus, transactionError }),
}));
