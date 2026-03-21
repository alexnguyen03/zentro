import { create } from 'zustand';
import { DeleteBookmark, GetBookmarks, SaveBookmark } from '../../wailsjs/go/app/App';
import { models } from '../../wailsjs/go/models';
import { useEditorStore } from './editorStore';
import { TAB_TYPE } from '../lib/constants';

type Bookmark = models.Bookmark;

interface BookmarkState {
  byTab: Record<string, Bookmark[]>;
  byKey: Record<string, Bookmark[]>;
  labelByKey: Record<string, string>;
  loadBookmarks: (connectionID: string, tabID: string) => Promise<void>;
  hydrateTabFromKey: (tabID: string, bookmarkKey: string) => void;
  toggleLine: (connectionID: string, tabID: string, line: number) => Promise<void>;
  nextLine: (tabID: string, fromLine: number) => number | null;
}

export const useBookmarkStore = create<BookmarkState>((set, get) => ({
  byTab: {},
  byKey: {},
  labelByKey: {},

  loadBookmarks: async (connectionID, tabID) => {
    if (!connectionID || !tabID) return;
    const bookmarkKey = resolveBookmarkKey(tabID);
    const bookmarkLabel = resolveBookmarkLabel(tabID);
    const items = await GetBookmarks(connectionID, bookmarkKey);
    const sorted = [...(items || [])].sort((a, b) => a.line - b.line);
    set((state) => ({
      byTab: { ...state.byTab, [tabID]: sorted },
      byKey: { ...state.byKey, [bookmarkKey]: sorted },
      labelByKey: { ...state.labelByKey, [bookmarkKey]: bookmarkLabel },
    }));
  },

  hydrateTabFromKey: (tabID, bookmarkKey) => {
    if (!tabID || !bookmarkKey) return;
    set((state) => {
      const fromKey = state.byKey[bookmarkKey] || [];
      if (!fromKey.length) return state;
      return {
        byTab: { ...state.byTab, [tabID]: [...fromKey].sort((a, b) => a.line - b.line) },
      };
    });
  },

  toggleLine: async (connectionID, tabID, line) => {
    if (!connectionID || !tabID || line <= 0) return;
    const bookmarkKey = resolveBookmarkKey(tabID);
    const state = get();
    const current = state.byTab[tabID] || state.byKey[bookmarkKey] || [];
    const exists = current.some((b) => b.line === line);
    if (exists) {
      await DeleteBookmark(connectionID, bookmarkKey, line);
    } else {
      await SaveBookmark(connectionID, bookmarkKey, new models.Bookmark({ line, label: `Line ${line}` }));
    }
    await get().loadBookmarks(connectionID, tabID);
  },

  nextLine: (tabID, fromLine) => {
    const lines = (get().byTab[tabID] || []).map((b) => b.line).sort((a, b) => a - b);
    if (!lines.length) return null;
    const next = lines.find((line) => line > fromLine);
    return next ?? lines[0];
  },
}));

function resolveBookmarkKey(tabID: string): string {
  const state = useEditorStore.getState();
  const tab = state.groups.flatMap((g) => g.tabs).find((t) => t.id === tabID);
  if (!tab) return `tabid:${tabID}`;
  if (tab.type && tab.type !== TAB_TYPE.QUERY) {
    return `tabid:${tabID}`;
  }
  const stableName = normalizeBookmarkName(tab.name || '');
  if (!stableName) return `tabid:${tabID}`;
  return `query:${stableName}`;
}

function resolveBookmarkLabel(tabID: string): string {
  const state = useEditorStore.getState();
  const tab = state.groups.flatMap((g) => g.tabs).find((t) => t.id === tabID);
  return tab?.name || tabID;
}

function normalizeBookmarkName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function bookmarkKeyFromTabName(tabName: string): string {
  const stableName = normalizeBookmarkName(tabName || '');
  return stableName ? `query:${stableName}` : '';
}

export function bookmarkLabelFromKey(key: string): string {
  if (key.startsWith('query:')) {
    return key.slice('query:'.length);
  }
  if (key.startsWith('tabid:')) {
    return key.slice('tabid:'.length);
  }
  return key;
}
