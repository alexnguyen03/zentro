import { wailsGateway } from '../platform/app-api/wailsGateway';

export const GetHistory = () => wailsGateway.GetHistory();
export const ClearHistory = () => wailsGateway.ClearHistory();
