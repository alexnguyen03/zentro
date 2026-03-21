import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { STORAGE_KEY, ConnectionStatus, CONNECTION_STATUS } from '../lib/constants';
import type { ConnectionProfile } from '../types/connection';
import { withStoreLogger } from './logger';

interface ConnectionState {
    connections: ConnectionProfile[];
    activeProfile: ConnectionProfile | null;
    isConnected: boolean;
    connectionStatus: ConnectionStatus;
    databases: string[];
    lastProfileName: string | null;
    lastDatabaseName: string | null;

    setConnections: (conns: ConnectionProfile[]) => void;
    setActiveProfile: (profile: ConnectionProfile | null) => void;
    setIsConnected: (connected: boolean) => void;
    setConnectionStatus: (status: ConnectionStatus) => void;
    setDatabases: (dbs: string[]) => void;
}

export const useConnectionStore = create<ConnectionState>()(
    persist(
        withStoreLogger('connectionStore', (set) => ({
            connections: [],
            activeProfile: null,
            isConnected: false,
            connectionStatus: CONNECTION_STATUS.DISCONNECTED,
            databases: [],
            lastProfileName: null,
            lastDatabaseName: null,

            setConnections: (conns) => set({ connections: conns }),
            setActiveProfile: (profile) => set((state) => ({
                activeProfile: profile,
                lastProfileName: profile ? profile.name : state.lastProfileName,
                lastDatabaseName: profile ? profile.db_name : state.lastDatabaseName
            })),
            setIsConnected: (connected) => set({ isConnected: connected }),
            setConnectionStatus: (status) => set({ connectionStatus: status }),
            setDatabases: (dbs) => set({ databases: dbs })
        })),
        {
            name: STORAGE_KEY.CONNECTION_STORE,
            partialize: (state) => ({
                activeProfile: state.activeProfile,
                isConnected: state.isConnected,
                connectionStatus: state.connectionStatus,
                lastProfileName: state.lastProfileName,
                lastDatabaseName: state.lastDatabaseName,
                databases: state.databases
            })
        }
    )
);
