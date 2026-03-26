import type { models } from '../../wailsjs/go/models';
import { wailsGateway } from '../platform/app-api/wailsGateway';

export const LoadTemplates = () => wailsGateway.LoadTemplates();
export const SaveTemplate = (template: models.Template) => wailsGateway.SaveTemplate(template);
export const DeleteTemplate = (templateId: string) => wailsGateway.DeleteTemplate(templateId);
