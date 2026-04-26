import { getCommandRegistry, normalizeBinding, type CommandId } from './shortcutRegistry';

export type ShortcutRuleSource = 'system' | 'user';

export interface ShortcutRule {
    id: string;
    commandId: CommandId;
    binding: string;
    when: string;
    source: ShortcutRuleSource;
    order: number;
}

export interface ShortcutRuleDraft {
    id?: string;
    commandId: CommandId;
    binding: string;
    when?: string;
    source?: ShortcutRuleSource;
    order?: number;
}

export function normalizeRuleWhen(when: string | undefined): string {
    return (when || '').trim();
}

export function normalizeRuleBinding(binding: string): string {
    return normalizeBinding(binding || '');
}

export function createRuleId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return `rule_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function normalizeOrder(value: number | undefined): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
    return Math.max(0, Math.floor(value));
}

export function toUserRule(draft: ShortcutRuleDraft): ShortcutRule {
    return {
        id: draft.id || createRuleId(),
        commandId: draft.commandId,
        binding: normalizeRuleBinding(draft.binding),
        when: normalizeRuleWhen(draft.when),
        source: 'user',
        order: normalizeOrder(draft.order),
    };
}

export function sortRules<T extends Pick<ShortcutRule, 'order'>>(rules: T[]): T[] {
    return [...rules].sort((a, b) => a.order - b.order);
}

export function buildSystemRules(): ShortcutRule[] {
    return getCommandRegistry().map((command, index) => ({
        id: `system:${command.id}`,
        commandId: command.id,
        binding: normalizeRuleBinding(command.defaultBinding),
        when: normalizeRuleWhen(command.defaultWhen),
        source: 'system' as const,
        order: index,
    }));
}

export function buildCommandLookup() {
    return new Map(getCommandRegistry().map((command) => [command.id, command]));
}

export function sanitizeUserRules(rawRules: ShortcutRuleDraft[] | undefined): ShortcutRule[] {
    const commandLookup = buildCommandLookup();
    if (!Array.isArray(rawRules)) return [];

    const out: ShortcutRule[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < rawRules.length; i += 1) {
        const item = rawRules[i];
        if (!item || !commandLookup.has(item.commandId)) continue;
        const binding = normalizeRuleBinding(item.binding || '');
        if (!binding) continue;
        const rule: ShortcutRule = {
            id: item.id || createRuleId(),
            commandId: item.commandId,
            binding,
            when: normalizeRuleWhen(item.when),
            source: 'user',
            order: normalizeOrder(item.order ?? i),
        };
        const dedupeKey = `${rule.commandId}|${rule.binding}|${rule.when}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);
        out.push(rule);
    }

    return sortRules(out).map((rule, index) => ({ ...rule, order: index }));
}

export function migrateLegacyBindingsToUserRules(legacyBindings: Record<string, string> | undefined): ShortcutRule[] {
    const commandLookup = buildCommandLookup();
    if (!legacyBindings) return [];

    const out: ShortcutRule[] = [];
    for (const command of getCommandRegistry()) {
        const raw = legacyBindings[command.id];
        if (!raw || !raw.trim()) continue;
        const normalizedLegacy = normalizeRuleBinding(raw);
        const normalizedDefault = normalizeRuleBinding(command.defaultBinding);
        // Only keep explicit overrides; default-value mirrors from legacy map should not become user rules.
        if (normalizedLegacy === normalizedDefault) continue;
        if (!commandLookup.has(command.id)) continue;
        out.push({
            id: createRuleId(),
            commandId: command.id,
            binding: normalizedLegacy,
            when: '',
            source: 'user',
            order: out.length,
        });
    }

    return out;
}

export function buildEffectiveRules(userRules: ShortcutRule[]): ShortcutRule[] {
    const normalizedUsers = sanitizeUserRules(userRules);
    const usersByCommand = new Map<CommandId, ShortcutRule[]>();
    normalizedUsers.forEach((rule) => {
        const list = usersByCommand.get(rule.commandId) || [];
        list.push(rule);
        usersByCommand.set(rule.commandId, list);
    });
    usersByCommand.forEach((list, commandId) => {
        usersByCommand.set(commandId, sortRules(list).map((rule, index) => ({ ...rule, order: index })));
    });

    const systemRules = buildSystemRules();
    const out: ShortcutRule[] = [];
    systemRules.forEach((systemRule) => {
        const userForCommand = usersByCommand.get(systemRule.commandId);
        if (userForCommand && userForCommand.length > 0) {
            out.push(...userForCommand);
            return;
        }
        out.push(systemRule);
    });
    return out;
}

export function buildLegacyBindingMirror(userRules: ShortcutRule[]): Record<CommandId, string> {
    const effective = buildEffectiveRules(userRules);
    const mirror: Partial<Record<CommandId, string>> = {};
    const fallback = new Map(getCommandRegistry().map((command) => [command.id, normalizeRuleBinding(command.defaultBinding)]));
    effective.forEach((rule) => {
        if (mirror[rule.commandId]) return;
        mirror[rule.commandId] = normalizeRuleBinding(rule.binding);
    });
    for (const [commandId, value] of fallback.entries()) {
        if (!mirror[commandId]) {
            mirror[commandId] = value;
        }
    }
    return mirror as Record<CommandId, string>;
}

export function hasCrossCommandConflict(
    rules: ShortcutRule[],
    candidate: { commandId: CommandId; binding: string; ignoreRuleId?: string },
): CommandId | null {
    const normalized = normalizeRuleBinding(candidate.binding);
    if (!normalized) return null;
    const matched = rules.find((rule) => {
        if (candidate.ignoreRuleId && rule.id === candidate.ignoreRuleId) return false;
        return normalizeRuleBinding(rule.binding) === normalized && rule.commandId !== candidate.commandId;
    });
    return matched?.commandId || null;
}

export function hasDuplicateWithinCommand(
    rules: ShortcutRule[],
    candidate: { commandId: CommandId; binding: string; ignoreRuleId?: string },
): boolean {
    const normalizedBinding = normalizeRuleBinding(candidate.binding);
    return rules.some((rule) => {
        if (candidate.ignoreRuleId && rule.id === candidate.ignoreRuleId) return false;
        return rule.commandId === candidate.commandId
            && normalizeRuleBinding(rule.binding) === normalizedBinding;
    });
}
