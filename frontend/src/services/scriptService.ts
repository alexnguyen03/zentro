import type { models } from '../../wailsjs/go/models';
import { wailsGateway } from '../platform/app-api/wailsGateway';

export const GetScripts = (connectionName: string) => wailsGateway.GetScripts(connectionName);
export const GetScriptContent = (connectionName: string, scriptId: string) => wailsGateway.GetScriptContent(connectionName, scriptId);
export const SaveScript = (script: models.SavedScript, content: string) => wailsGateway.SaveScript(script, content);
export const DeleteScript = (connectionName: string, scriptId: string) => wailsGateway.DeleteScript(connectionName, scriptId);
