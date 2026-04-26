import type {
    PluginContribution,
    PluginManifest,
    PluginCapability,
    ResolvedPluginCommand,
} from './contracts';

const CONTRIBUTION_HOST_KEY = '__zentroPluginContributions__';

interface ContributionHost {
    [CONTRIBUTION_HOST_KEY]?: Map<string, PluginContribution>;
}

function host(): ContributionHost {
    return globalThis as ContributionHost;
}

function store(): Map<string, PluginContribution> {
    const h = host();
    if (!h[CONTRIBUTION_HOST_KEY]) {
        h[CONTRIBUTION_HOST_KEY] = new Map<string, PluginContribution>();
    }
    return h[CONTRIBUTION_HOST_KEY] as Map<string, PluginContribution>;
}

export interface PluginValidationResult {
    valid: boolean;
    errors: string[];
}

export function validateManifest(manifest: PluginManifest): PluginValidationResult {
    const errors: string[] = [];
    if (!manifest.id?.trim()) errors.push('manifest.id is required');
    if (!manifest.version?.trim()) errors.push('manifest.version is required');
    if (!manifest.minAppVersion?.trim()) errors.push('manifest.minAppVersion is required');
    if (!Array.isArray(manifest.capabilities)) errors.push('manifest.capabilities must be an array');
    return { valid: errors.length === 0, errors };
}

export function registerPluginContribution(contribution: PluginContribution): () => void {
    const check = validateManifest(contribution.manifest);
    if (!check.valid) {
        throw new Error(`Invalid plugin manifest: ${check.errors.join(', ')}`);
    }

    const pluginStore = store();
    pluginStore.set(contribution.manifest.id, contribution);

    return () => {
        pluginStore.delete(contribution.manifest.id);
    };
}

export function listPluginContributions(): PluginContribution[] {
    return [...store().values()];
}

export function listByCapability(capability: PluginCapability): PluginContribution[] {
    return listPluginContributions().filter((item) => item.manifest.capabilities.includes(capability));
}

export function resolvePluginCommands(
    handlerResolver: (pluginId: string, handlerKey: string) => () => void | Promise<void>,
): ResolvedPluginCommand[] {
    const out: ResolvedPluginCommand[] = [];
    for (const contribution of listByCapability('ui.commands')) {
        const commands = contribution.commands ?? [];
        for (const command of commands) {
            out.push({
                pluginId: contribution.manifest.id,
                entry: {
                    id: command.id,
                    label: command.title,
                    category: command.category,
                    defaultBinding: command.defaultBinding,
                    defaultWhen: command.defaultWhen,
                    action: handlerResolver(contribution.manifest.id, command.handlerKey),
                },
            });
        }
    }
    return out;
}
