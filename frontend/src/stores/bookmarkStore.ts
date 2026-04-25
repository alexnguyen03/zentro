import { create } from 'zustand';
import { DeleteBookmark, GetBookmarks, GetBookmarksByConnection, SaveBookmark } from '../services/bookmarkService';
import { models } from '../../wailsjs/go/models';
import { useEditorStore } from './editorStore';
import { useProjectStore } from './projectStore';
import { TAB_TYPE } from '../lib/constants';

type Bookmark = models.Bookmark;

interface BookmarkState {
  activeScopeID: string | null;
  byTab: Record<string, Bookmark[]>;
  byKey: Record<string, Bookmark[]>;
  labelByKey: Record<string, string>;
  loadBookmarks: (connectionID: string, tabID: string) => Promise<void>;
  loadAllBookmarksForScope: (connectionID: string) => Promise<void>;
  remapTabBookmarks: (connectionID: string, tabID: string, oldTabName: string, newTabName: string) => Promise<void>;
  hydrateTabFromKey: (tabID: string, bookmarkKey: string) => void;
  toggleLine: (connectionID: string, tabID: string, line: number) => Promise<void>;
  nextLine: (tabID: string, fromLine: number) => number | null;
}

export const useBookmarkStore = create<BookmarkState>((set, get) => ({
  activeScopeID: null,
  byTab: {},
  byKey: {},
  labelByKey: {},

  loadBookmarks: async (connectionID, tabID) => {
    if (!connectionID || !tabID) return;
    const scopeID = getBookmarkScopeID(connectionID);
    const scopedConnectionID = resolveScopedConnectionID(connectionID);
    const bookmarkKey = resolveBookmarkKey(tabID);
    const bookmarkLabel = resolveBookmarkLabel(tabID);
    const items = await GetBookmarks(scopedConnectionID, bookmarkKey);
    const sorted = [...(items || [])].sort((a, b) => a.line - b.line);
    set((state) => ({
      activeScopeID: scopeID,
      byTab: {
        ...(state.activeScopeID === scopeID ? state.byTab : {}),
        [tabID]: sorted,
      },
      byKey: {
        ...(state.activeScopeID === scopeID ? state.byKey : {}),
        [bookmarkKey]: sorted,
      },
      labelByKey: {
        ...(state.activeScopeID === scopeID ? state.labelByKey : {}),
        [bookmarkKey]: bookmarkLabel,
      },
    }));
  },

  loadAllBookmarksForScope: async (connectionID) => {
    if (!connectionID) return;
    const scopeID = getBookmarkScopeID(connectionID);
    const scopedConnectionID = resolveScopedConnectionID(connectionID);
    const grouped = await GetBookmarksByConnection(scopedConnectionID);
    const labelByKeyFromOpenTabs = getOpenTabLabelsByBookmarkKey();
    set((state) => {
      const nextByKey: Record<string, Bookmark[]> = {
        ...(state.activeScopeID === scopeID ? state.byKey : {}),
      };
      const nextLabelByKey: Record<string, string> = {
        ...(state.activeScopeID === scopeID ? state.labelByKey : {}),
      };

      Object.entries(grouped || {}).forEach(([bookmarkKey, items]) => {
        nextByKey[bookmarkKey] = [...(items || [])].sort((a, b) => a.line - b.line);
        nextLabelByKey[bookmarkKey] =
          labelByKeyFromOpenTabs[bookmarkKey]
          || nextLabelByKey[bookmarkKey]
          || bookmarkLabelFromKey(bookmarkKey);
      });

      return {
        activeScopeID: scopeID,
        byTab: state.activeScopeID === scopeID ? state.byTab : {},
        byKey: nextByKey,
        labelByKey: nextLabelByKey,
      };
    });
  },

  remapTabBookmarks: async (connectionID, tabID, oldTabName, newTabName) => {
    if (!connectionID || !tabID) return;
    const oldKey = bookmarkKeyFromTabName(oldTabName);
    const newKey = bookmarkKeyFromTabName(newTabName);
    if (!oldKey || !newKey) return;

    if (oldKey === newKey) {
      set((state) => ({
        labelByKey: {
          ...state.labelByKey,
          [newKey]: newTabName,
        },
      }));
      await get().loadBookmarks(connectionID, tabID);
      return;
    }

    const scopedConnectionID = resolveScopedConnectionID(connectionID);
    const existing = await GetBookmarks(scopedConnectionID, oldKey);
    if ((existing || []).length === 0) {
      await get().loadBookmarks(connectionID, tabID);
      return;
    }

    const sorted = [...existing].sort((a, b) => a.line - b.line);
    for (const bookmark of sorted) {
      await SaveBookmark(scopedConnectionID, newKey, new models.Bookmark({ line: bookmark.line, label: bookmark.label || `Line ${bookmark.line}` }));
    }
    for (const bookmark of sorted) {
      await DeleteBookmark(scopedConnectionID, oldKey, bookmark.line);
    }

    await get().loadAllBookmarksForScope(connectionID);
    await get().loadBookmarks(connectionID, tabID);
    set((state) => ({
      labelByKey: {
        ...state.labelByKey,
        [newKey]: newTabName,
      },
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
    const scopedConnectionID = resolveScopedConnectionID(connectionID);
    const bookmarkKey = resolveBookmarkKey(tabID);
    const state = get();
    const current = state.byTab[tabID] || state.byKey[bookmarkKey] || [];
    const exists = current.some((b) => b.line === line);
    if (exists) {
      await DeleteBookmark(scopedConnectionID, bookmarkKey, line);
    } else {
      await SaveBookmark(scopedConnectionID, bookmarkKey, new models.Bookmark({ line, label: `Line ${line}` }));
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

export function getBookmarkScopeID(connectionID: string): string {
  const projectID = useProjectStore.getState().activeProject?.id || '__default_project__';
  return `${projectID}::${connectionID}`;
}

function resolveScopedConnectionID(connectionID: string): string {
  return getBookmarkScopeID(connectionID);
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
    return toDisplayName(key.slice('query:'.length));
  }
  if (key.startsWith('tabid:')) {
    return key.slice('tabid:'.length);
  }
  return key;
}

function toDisplayName(value: string): string {
  return value
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function getOpenTabLabelsByBookmarkKey(): Record<string, string> {
  const state = useEditorStore.getState();
  const out: Record<string, string> = {};
  state.groups.forEach((group) => {
    group.tabs.forEach((tab) => {
      if (!tab.name) return;
      if (tab.type && tab.type !== TAB_TYPE.QUERY) {
        out[`tabid:${tab.id}`] = tab.name;
        return;
      }
      const key = bookmarkKeyFromTabName(tab.name);
      if (!key) return;
      out[key] = tab.name;
    });
  });
  return out;
}

