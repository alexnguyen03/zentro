import { create } from 'zustand';
import { models } from '../../wailsjs/go/models';

type ConnectionProfile = models.ConnectionProfile;

interface ConnectionState {
    connections: ConnectionProfile[];
    activeProfile: ConnectionProfile | null;
    isConnected: boolean;
    databases: string[];

    setConnections: (conns: ConnectionProfile[]) => void;
    setActiveProfile: (profile: ConnectionProfile | null) => void;
    setIsConnected: (connected: boolean) => void;
    setDatabases: (dbs: string[]) => void;
}

export const useConnectionStore = create<ConnectionState>((set) => ({
    connections: [],
    activeProfile: null,
    isConnected: false,
    databases: [],

    setConnections: (conns) => set({ connections: conns }),
    setActiveProfile: (profile) => set({ activeProfile: profile }),
    setIsConnected: (connected) => set({ isConnected: connected }),
    setDatabases: (dbs) => set({ databases: dbs })
}));
