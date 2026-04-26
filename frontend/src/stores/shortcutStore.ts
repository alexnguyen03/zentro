import { create } from 'zustand';
import { GetPreferences, SetPreferences } from '../services/settingsService';
import { getCommandById, type CommandId } from '../lib/shortcutRegistry';
import {
  buildEffectiveRules,
  buildLegacyBindingMirror,
  hasCrossCommandConflict,
  hasDuplicateWithinCommand,
  migrateLegacyBindingsToUserRules,
  normalizeRuleBinding,
  sanitizeUserRules,
  toUserRule,
  type ShortcutRule,
} from '../lib/shortcutRules';

type ConflictResult = { ok: true } | { ok: false; conflictWith?: CommandId };

interface ShortcutState {
  bindings: Record<CommandId, string>;
  userRules: ShortcutRule[];
  effectiveRules: ShortcutRule[];
  chordStart: string | null;
  chordUntil: number;
  loadFromPreferences: (shortcuts?: Record<string, string>, shortcutRules?: unknown[]) => void;
  replaceBindings: (shortcuts?: Record<string, string>) => Promise<void>;
  replaceShortcutRules: (rules?: ShortcutRule[]) => Promise<void>;
  setBinding: (id: CommandId, binding: string) => Promise<ConflictResult>;
  addBinding: (id: CommandId, binding: string, when?: string) => Promise<ConflictResult>;
  updateRuleBinding: (ruleId: string, binding: string) => Promise<ConflictResult>;
  removeRule: (ruleId: string) => Promise<void>;
  restoreBinding: (id: CommandId) => Promise<void>;
  resetDefaults: () => Promise<void>;
  getBinding: (id: CommandId) => string;
  getRulesForCommand: (id: CommandId) => ShortcutRule[];
  setChord: (token: string | null) => void;
}

function deriveState(userRulesInput: ShortcutRule[]) {
  const userRules = sanitizeUserRules(userRulesInput);
  const effectiveRules = buildEffectiveRules(userRules);
  const bindings = buildLegacyBindingMirror(userRules);
  return { userRules, effectiveRules, bindings };
}

async function persistState(userRules: ShortcutRule[]) {
  const prefs = await GetPreferences();
  const bindings = buildLegacyBindingMirror(userRules);
  prefs.shortcuts = { ...bindings };
  prefs.shortcut_rules = userRules.map((rule) => ({
    id: rule.id,
    command_id: rule.commandId,
    binding: rule.binding,
    when: rule.when,
    source: 'user',
    order: rule.order,
  }));
  await SetPreferences(prefs);
}

function parseModelRules(shortcutRules?: unknown[]): ShortcutRule[] {
  if (!Array.isArray(shortcutRules)) return [];
  const parsed: ShortcutRule[] = shortcutRules.map((rule) => {
    const source = rule as Record<string, unknown>;
    return {
      id: typeof source.id === 'string' ? source.id : '',
      commandId: (source.command_id as CommandId | undefined) || (source.commandId as CommandId | undefined) || ('' as CommandId),
      binding: typeof source.binding === 'string' ? source.binding : '',
      when: typeof source.when === 'string' ? source.when : '',
      source: 'user' as const,
      order: typeof source.order === 'number' ? source.order : 0,
    };
  }).filter((rule) => typeof rule.commandId === 'string' && typeof rule.binding === 'string');
  return sanitizeUserRules(parsed);
}

export const useShortcutStore = create<ShortcutState>((set, get) => {
  return {
    bindings: {} as Record<CommandId, string>,
    userRules: [],
    effectiveRules: [],
    chordStart: null,
    chordUntil: 0,

    loadFromPreferences: (shortcuts, shortcutRules) => {
      const parsedRules = parseModelRules(shortcutRules);
      const userRules = parsedRules.length > 0
        ? parsedRules
        : migrateLegacyBindingsToUserRules(shortcuts);
      set(deriveState(userRules));
    },

    replaceBindings: async (shortcuts) => {
      const nextRules = migrateLegacyBindingsToUserRules(shortcuts);
      set(deriveState(nextRules));
      await persistState(nextRules);
    },

    replaceShortcutRules: async (rules) => {
      const nextRules = sanitizeUserRules(rules || []);
      set(deriveState(nextRules));
      await persistState(nextRules);
    },

    setBinding: async (id, binding) => {
      const normalized = normalizeRuleBinding(binding);
      if (!normalized) return { ok: false };

      const state = get();
      const crossConflict = hasCrossCommandConflict(state.effectiveRules, { commandId: id, binding: normalized });
      if (crossConflict) {
        return { ok: false, conflictWith: crossConflict };
      }

      const nextUserRules = state.userRules.filter((rule) => rule.commandId !== id);
      nextUserRules.push(toUserRule({ commandId: id, binding: normalized, order: 0 }));
      const sanitized = sanitizeUserRules(nextUserRules);
      set(deriveState(sanitized));
      await persistState(sanitized);
      return { ok: true };
    },

    addBinding: async (id, binding, when = '') => {
      const normalized = normalizeRuleBinding(binding);
      if (!normalized) return { ok: false };

      const state = get();
      const crossConflict = hasCrossCommandConflict(state.effectiveRules, { commandId: id, binding: normalized });
      if (crossConflict) {
        return { ok: false, conflictWith: crossConflict };
      }

      if (hasDuplicateWithinCommand(state.effectiveRules, { commandId: id, binding: normalized })) {
        return { ok: false, conflictWith: id };
      }

      const currentCommandRules = state.userRules.filter((rule) => rule.commandId === id);
      const nextUserRules = [
        ...state.userRules.filter((rule) => rule.commandId !== id),
        ...currentCommandRules.map((rule, index) => ({ ...rule, order: index })),
        toUserRule({ commandId: id, binding: normalized, when, order: currentCommandRules.length }),
      ];
      const sanitized = sanitizeUserRules(nextUserRules);
      set(deriveState(sanitized));
      await persistState(sanitized);
      return { ok: true };
    },

    updateRuleBinding: async (ruleId, binding) => {
      const normalized = normalizeRuleBinding(binding);
      if (!normalized) return { ok: false };

      const state = get();
      const target = state.userRules.find((rule) => rule.id === ruleId);
      if (!target) return { ok: false };

      const crossConflict = hasCrossCommandConflict(state.effectiveRules, {
        commandId: target.commandId,
        binding: normalized,
        ignoreRuleId: ruleId,
      });
      if (crossConflict) {
        return { ok: false, conflictWith: crossConflict };
      }

      if (hasDuplicateWithinCommand(state.effectiveRules, {
        commandId: target.commandId,
        binding: normalized,
        ignoreRuleId: ruleId,
      })) {
        return { ok: false, conflictWith: target.commandId };
      }

      const nextUserRules = state.userRules.map((rule) => (
        rule.id === ruleId ? { ...rule, binding: normalized } : rule
      ));
      const sanitized = sanitizeUserRules(nextUserRules);
      set(deriveState(sanitized));
      await persistState(sanitized);
      return { ok: true };
    },

    removeRule: async (ruleId) => {
      const state = get();
      const nextUserRules = state.userRules.filter((rule) => rule.id !== ruleId);
      const sanitized = sanitizeUserRules(nextUserRules);
      set(deriveState(sanitized));
      await persistState(sanitized);
    },

    restoreBinding: async (id) => {
      const state = get();
      const nextUserRules = state.userRules.filter((rule) => rule.commandId !== id);
      const sanitized = sanitizeUserRules(nextUserRules);
      set(deriveState(sanitized));
      await persistState(sanitized);
    },

    resetDefaults: async () => {
      set(deriveState([]));
      await persistState([]);
    },

    getBinding: (id) => get().bindings[id] || normalizeRuleBinding(getCommandById(id)?.defaultBinding || ''),
    getRulesForCommand: (id) => get().effectiveRules.filter((rule) => rule.commandId === id),

    setChord: (token) => {
      if (!token) {
        set({ chordStart: null, chordUntil: 0 });
        return;
      }
      set({ chordStart: token, chordUntil: Date.now() + 1200 });
    },
  };
});

export type { ShortcutRule };
