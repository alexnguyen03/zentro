import type { models } from '../../wailsjs/go/models';
import { wailsGateway } from '../platform/app-api/wailsGateway';
export type { ConnectionRuntimeState, RuntimeConnectionStatus } from '../platform/app-api/types';

export const Connect = (database: string) => wailsGateway.Connect(database);
export const Disconnect = () => wailsGateway.Disconnect();
export const Reconnect = () => wailsGateway.Reconnect();
export const SwitchDatabase = (database: string) => wailsGateway.SwitchDatabase(database);
export const LoadConnections = () => wailsGateway.LoadConnections();
export const LoadDatabasesForProfile = (profileName: string) => wailsGateway.LoadDatabasesForProfile(profileName);
export const SaveConnection = (profile: models.ConnectionProfile) => wailsGateway.SaveConnection(profile);
export const ImportConnectionPackage = () => wailsGateway.ImportConnectionPackage();
export const ExportConnectionPackage = (environmentKey: string) => wailsGateway.ExportConnectionPackage(environmentKey);
export const TestConnection = (profile: models.ConnectionProfile) => wailsGateway.TestConnection(profile);
export const GetConnectionStatus = () => wailsGateway.GetConnectionStatus();
