import { create } from 'zustand';
import { ConnectionStatus, CONNECTION_STATUS } from '../lib/constants';
import type { ConnectionProfile } from '../types/connection';
import { withStoreLogger } from './logger';

interface ConnectionState {
    connections: ConnectionProfile[];
    activeProfile: ConnectionProfile | null;
    isConnected: boolean;
    connectionStatus: ConnectionStatus;
    databases: string[];

    setConnections: (conns: ConnectionProfile[]) => void;
    setActiveProfile: (profile: ConnectionProfile | null) => void;
    setIsConnected: (connected: boolean) => void;
    setConnectionStatus: (status: ConnectionStatus) => void;
    setDatabases: (dbs: string[]) => void;
    resetRuntime: () => void;
}

export const useConnectionStore = create<ConnectionState>()(
    withStoreLogger('connectionStore', (set) => ({
        connections: [],
        activeProfile: null,
        isConnected: false,
        connectionStatus: CONNECTION_STATUS.DISCONNECTED,
        databases: [],

        setConnections: (connections) => set({ connections }),
        setActiveProfile: (activeProfile) => set({ activeProfile }),
        setIsConnected: (isConnected) => set({ isConnected }),
        setConnectionStatus: (connectionStatus) => set({ connectionStatus }),
        setDatabases: (databases) => set({ databases }),
        resetRuntime: () => set({
            activeProfile: null,
            isConnected: false,
            connectionStatus: CONNECTION_STATUS.DISCONNECTED,
            databases: [],
        }),
    }))
);
