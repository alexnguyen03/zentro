import { create } from 'zustand';
import { DeleteBookmark, GetBookmarks, SaveBookmark } from '../../wailsjs/go/app/App';
import { models } from '../../wailsjs/go/models';

type Bookmark = models.Bookmark;

interface BookmarkState {
  byTab: Record<string, Bookmark[]>;
  loadBookmarks: (connectionID: string, tabID: string) => Promise<void>;
  toggleLine: (connectionID: string, tabID: string, line: number) => Promise<void>;
  nextLine: (tabID: string, fromLine: number) => number | null;
}

export const useBookmarkStore = create<BookmarkState>((set, get) => ({
  byTab: {},

  loadBookmarks: async (connectionID, tabID) => {
    if (!connectionID || !tabID) return;
    const items = await GetBookmarks(connectionID, tabID);
    const sorted = [...(items || [])].sort((a, b) => a.line - b.line);
    set((state) => ({ byTab: { ...state.byTab, [tabID]: sorted } }));
  },

  toggleLine: async (connectionID, tabID, line) => {
    if (!connectionID || !tabID || line <= 0) return;
    const current = get().byTab[tabID] || [];
    const exists = current.some((b) => b.line === line);
    if (exists) {
      await DeleteBookmark(connectionID, tabID, line);
    } else {
      await SaveBookmark(connectionID, tabID, new models.Bookmark({ line, label: `Line ${line}` }));
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
