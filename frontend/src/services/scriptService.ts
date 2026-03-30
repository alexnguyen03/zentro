import type { models } from '../../wailsjs/go/models';
import { wailsGateway } from '../platform/app-api/wailsGateway';

export const GetScripts = (projectId: string, connectionName: string) => wailsGateway.GetScripts(projectId, connectionName);
export const GetScriptContent = (projectId: string, connectionName: string, scriptId: string) => wailsGateway.GetScriptContent(projectId, connectionName, scriptId);
export const SaveScript = (script: models.SavedScript, content: string) => wailsGateway.SaveScript(script, content);
export const DeleteScript = (projectId: string, connectionName: string, scriptId: string) => wailsGateway.DeleteScript(projectId, connectionName, scriptId);
