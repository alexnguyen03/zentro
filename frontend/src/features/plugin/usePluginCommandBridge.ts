import { useEffect } from 'react';
import { emitCommand } from '../../lib/commandBus';
import { DOM_EVENT } from '../../lib/constants';
import { registerCommandContribution } from '../../lib/shortcutRegistry';
import { resolvePluginCommands } from './registry';

export function usePluginCommandBridge() {
    useEffect(() => {
        const disposers = resolvePluginCommands((pluginId, handlerKey) => () => {
            emitCommand(DOM_EVENT.OPEN_PROJECT_HUB);
            console.info(`[plugin:${pluginId}] command handler not wired yet`, handlerKey);
        }).map((item) => registerCommandContribution(item.entry));

        return () => {
            for (const dispose of disposers) dispose();
        };
    }, []);
}

