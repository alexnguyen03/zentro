import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { models } from '../../wailsjs/go/models';

type ConnectionProfile = models.ConnectionProfile;

interface ConnectionState {
    connections: ConnectionProfile[];
    activeProfile: ConnectionProfile | null;
    isConnected: boolean;
    databases: string[];
    lastProfileName: string | null;
    lastDatabaseName: string | null;

    setConnections: (conns: ConnectionProfile[]) => void;
    setActiveProfile: (profile: ConnectionProfile | null) => void;
    setIsConnected: (connected: boolean) => void;
    setDatabases: (dbs: string[]) => void;
}

export const useConnectionStore = create<ConnectionState>()(
    persist(
        (set) => ({
            connections: [],
            activeProfile: null,
            isConnected: false,
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
            setDatabases: (dbs) => set({ databases: dbs })
        }),
        {
            name: 'zentro:connection-store',
            partialize: (state) => ({
                lastProfileName: state.lastProfileName,
                lastDatabaseName: state.lastDatabaseName,
            })
        }
    )
);
