import { create } from 'zustand';
import { GetPreferences, SetPreferences } from '../../wailsjs/go/app/App';
import { defaultShortcutMap, normalizeBinding, type CommandId } from '../lib/shortcutRegistry';

interface ShortcutState {
  bindings: Record<CommandId, string>;
  chordStart: string | null;
  chordUntil: number;
  loadFromPreferences: (shortcuts?: Record<string, string>) => void;
  setBinding: (id: CommandId, binding: string) => Promise<{ ok: boolean; conflictWith?: CommandId }>;
  restoreBinding: (id: CommandId) => Promise<void>;
  resetDefaults: () => Promise<void>;
  getBinding: (id: CommandId) => string;
  setChord: (token: string | null) => void;
}

function sanitizeBindings(shortcuts?: Record<string, string>): Record<CommandId, string> {
  const merged = { ...defaultShortcutMap };
  if (shortcuts) {
    (Object.keys(defaultShortcutMap) as CommandId[]).forEach((id) => {
      const value = shortcuts[id];
      if (value && value.trim()) {
        merged[id] = value;
      }
    });
  }
  return merged;
}

async function persistBindings(bindings: Record<CommandId, string>) {
  const prefs = await GetPreferences();
  prefs.shortcuts = { ...bindings };
  await SetPreferences(prefs);
}

export const useShortcutStore = create<ShortcutState>((set, get) => ({
  bindings: { ...defaultShortcutMap },
  chordStart: null,
  chordUntil: 0,

  loadFromPreferences: (shortcuts) => {
    set({ bindings: sanitizeBindings(shortcuts) });
  },

  setBinding: async (id, binding) => {
    const normalized = normalizeBinding(binding);
    const bindings = get().bindings;
    const conflict = (Object.keys(bindings) as CommandId[]).find(
      (cmd) => cmd !== id && normalizeBinding(bindings[cmd]) === normalized,
    );
    if (conflict) {
      return { ok: false, conflictWith: conflict };
    }

    const next = { ...bindings, [id]: binding.trim() };
    set({ bindings: next });
    await persistBindings(next);
    return { ok: true };
  },

  restoreBinding: async (id) => {
    const next = { ...get().bindings, [id]: defaultShortcutMap[id] };
    set({ bindings: next });
    await persistBindings(next);
  },

  resetDefaults: async () => {
    set({ bindings: { ...defaultShortcutMap } });
    await persistBindings({ ...defaultShortcutMap });
  },

  getBinding: (id) => get().bindings[id] ?? defaultShortcutMap[id],

  setChord: (token) => {
    if (!token) {
      set({ chordStart: null, chordUntil: 0 });
      return;
    }
    set({ chordStart: token, chordUntil: Date.now() + 1200 });
  },
}));
