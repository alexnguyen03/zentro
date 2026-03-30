import { create } from 'zustand';
import { CONNECTION_STATUS, TRANSACTION_STATUS } from '../lib/constants';
import type { QueryExecutionState, QueryFailureCode } from '../features/query/runtime';

interface StatusState {
    connectionLabel: string;
    status: typeof CONNECTION_STATUS[keyof typeof CONNECTION_STATUS];
    rowCount: number;
    duration: number;
    message: string | null;
    currentDriver: string;
    transactionStatus: typeof TRANSACTION_STATUS[keyof typeof TRANSACTION_STATUS];
    transactionError: string | null;
    queryExecutionState: QueryExecutionState;
    queryFailureCode: QueryFailureCode;
    firstRowLatencyMs: number | null;

    setConnectionLabel: (label: string) => void;
    setStatus: (status: StatusState['status']) => void;
    setQueryStats: (rowCount: number, duration: number) => void;
    setMessage: (message: string | null) => void;
    setCurrentDriver: (driver: string) => void;
    setTransactionStatus: (status: StatusState['transactionStatus'], error?: string | null) => void;
    setQueryRuntime: (state: QueryExecutionState, failureCode?: QueryFailureCode, firstRowLatencyMs?: number | null) => void;
}

export const useStatusStore = create<StatusState>((set) => ({
    connectionLabel: 'No Connection',
    status: CONNECTION_STATUS.DISCONNECTED,
    rowCount: 0,
    duration: 0,
    message: null,
    currentDriver: '',
    transactionStatus: TRANSACTION_STATUS.NONE,
    transactionError: null,
    queryExecutionState: 'done',
    queryFailureCode: 'none',
    firstRowLatencyMs: null,

    setConnectionLabel: (label) => set({ connectionLabel: label }),
    setStatus: (status) => set({ status }),
    setQueryStats: (rowCount, duration) => set({ rowCount, duration }),
    setMessage: (message) => set({ message }),
    setCurrentDriver: (driver) => set({ currentDriver: driver }),
    setTransactionStatus: (transactionStatus, transactionError = null) => set({ transactionStatus, transactionError }),
    setQueryRuntime: (queryExecutionState, queryFailureCode = 'none', firstRowLatencyMs = null) =>
        set({ queryExecutionState, queryFailureCode, firstRowLatencyMs }),
}));
