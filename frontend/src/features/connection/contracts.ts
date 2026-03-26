import type { models } from '../../../wailsjs/go/models';
import type { ConnectionRuntimeState } from '../../platform/app-api/types';

export interface ConnectionFeatureApi {
    connect(profileName: string): Promise<void>;
    reconnect(): Promise<void>;
    disconnect(): Promise<void>;
    testConnection(profile: models.ConnectionProfile): Promise<void>;
    getStatus(): Promise<ConnectionRuntimeState>;
}

