import { create } from 'zustand';
import { LoadTemplates, SaveTemplate, DeleteTemplate } from '../services/templateService';
import { models } from '../../wailsjs/go/models';
import { getErrorMessage } from '../lib/errors';

type Template = models.Template;

interface TemplateState {
    templates: Template[];
    isLoading: boolean;
    error: string | null;

    loadTemplates: () => Promise<void>;
    saveTemplate: (template: Template) => Promise<void>;
    deleteTemplate: (id: string) => Promise<void>;
}

export const useTemplateStore = create<TemplateState>((set, get) => ({
    templates: [],
    isLoading: false,
    error: null,

    loadTemplates: async () => {
        set({ isLoading: true, error: null });
        try {
            const templates = await LoadTemplates();
            set({ templates: templates || [], isLoading: false });
        } catch (err: unknown) {
            set({ error: getErrorMessage(err) || 'Failed to load templates', isLoading: false });
        }
    },

    saveTemplate: async (template: Template) => {
        set({ isLoading: true, error: null });
        try {
            await SaveTemplate(template);
            await get().loadTemplates();
        } catch (err: unknown) {
            set({ error: getErrorMessage(err) || 'Failed to save template', isLoading: false });
        }
    },

    deleteTemplate: async (id: string) => {
        set({ isLoading: true, error: null });
        try {
            await DeleteTemplate(id);
            await get().loadTemplates();
        } catch (err: unknown) {
            set({ error: getErrorMessage(err) || 'Failed to delete template', isLoading: false });
        }
    },
}));

