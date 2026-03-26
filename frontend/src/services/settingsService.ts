import type { utils } from '../../wailsjs/go/models';
import { wailsGateway } from '../platform/app-api/wailsGateway';

export const GetPreferences = () => wailsGateway.GetPreferences();
export const SetPreferences = (preferences: utils.Preferences) => wailsGateway.SetPreferences(preferences);
export const CheckForUpdates = () => wailsGateway.CheckForUpdates();
