import { wailsGateway } from '../platform/app-api/wailsGateway';

export const ForceQuit = () => wailsGateway.ForceQuit();
export const ConnectProjectEnvironment = (environmentKey: string) => wailsGateway.ConnectProjectEnvironment(environmentKey);
