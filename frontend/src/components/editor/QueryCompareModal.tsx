import React, { useEffect, useMemo, useRef, useState } from 'react';
import Editor, { DiffEditor } from '@monaco-editor/react';
import type { editor as MonacoEditor } from 'monaco-editor';
import { CompareQueries } from '../../services/queryService';
import { useEditorStore } from '../../stores/editorStore';
import {
  Button,
  Checkbox,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui';
import { useFeatureGate } from '../../features/license/useFeatureGate';
import { OverlayDialog } from '../layout/OverlayDialog';

interface QueryCompareModalProps {
  onClose: () => void;
}

export const QueryCompareModal: React.FC<QueryCompareModalProps> = ({ onClose }) => {
  const { groups, activeGroupId, updateTabContext } = useEditorStore();
  const featureGate = useFeatureGate();
  const canUseCompare = featureGate.canUse('query.result.compare');
  const activeGroup = groups.find((g) => g.id === activeGroupId);
  const activeTab = activeGroup?.tabs.find((t) => t.id === activeGroup?.activeTabId);
  const queryTabs = useMemo(
    () =>
      groups
        .flatMap((group, groupIndex) =>
          group.tabs
            .filter((tab) => tab.type === 'query')
            .map((tab, tabIndex) => ({
              id: tab.id,
              label: tab.name,
              query: tab.query,
              order: `${groupIndex.toString().padStart(3, '0')}-${tabIndex.toString().padStart(3, '0')}`,
            })),
        )
        .sort((a, b) => a.order.localeCompare(b.order)),
    [groups],
  );

  const context = activeTab?.context;
  const fallbackRight = useMemo(
    () => queryTabs.find((tab) => tab.id !== activeTab?.id)?.id || '',
    [activeTab?.id, queryTabs],
  );

  const [leftTabId, setLeftTabId] = useState(context?.compareLeftTabId || activeTab?.id || '');
  const [rightTabId, setRightTabId] = useState(context?.compareRightTabId || fallbackRight);
  const [showUnified, setShowUnified] = useState(context?.compareShowUnified || false);
  const [ignoreWhitespace, setIgnoreWhitespace] = useState(context?.compareIgnoreWhitespace || false);
  const [unifiedDiff, setUnifiedDiff] = useState('');
  const [syncScroll, setSyncScroll] = useState(context?.compareSyncScroll ?? true);

  const originalRef = useRef<MonacoEditor.ICodeEditor | null>(null);
  const modifiedRef = useRef<MonacoEditor.ICodeEditor | null>(null);
  const syncingRef = useRef(false);

  useEffect(() => {
    if (!activeTab?.id) return;
    if (!leftTabId) setLeftTabId(activeTab.id);
    if (!rightTabId && fallbackRight) setRightTabId(fallbackRight);
  }, [activeTab?.id, fallbackRight, leftTabId, rightTabId]);

  const leftQuery = useMemo(
    () => queryTabs.find((tab) => tab.id === leftTabId)?.query || '',
    [leftTabId, queryTabs],
  );
  const rightQuery = useMemo(
    () => queryTabs.find((tab) => tab.id === rightTabId)?.query || '',
    [queryTabs, rightTabId],
  );

  const normalizeSql = (sql: string) => {
    const lf = sql.replace(/\r\n/g, '\n');
    if (!ignoreWhitespace) return lf;
    return lf
      .split('\n')
      .map((line) => line.trim().replace(/\s+/g, ' '))
      .filter((line) => line.length > 0)
      .join('\n');
  };

  useEffect(() => {
    if (!activeTab?.id) return;
    updateTabContext(activeTab.id, {
      compareLeftTabId: leftTabId,
      compareRightTabId: rightTabId,
      compareSyncScroll: syncScroll,
      compareIgnoreWhitespace: ignoreWhitespace,
      compareShowUnified: showUnified,
    });
  }, [activeTab?.id, ignoreWhitespace, leftTabId, rightTabId, showUnified, syncScroll, updateTabContext]);

  useEffect(() => {
    if (!syncScroll || !originalRef.current || !modifiedRef.current) return;

    const original = originalRef.current;
    const modified = modifiedRef.current;

    const syncTo = (src: MonacoEditor.ICodeEditor, dst: MonacoEditor.ICodeEditor) => {
      if (syncingRef.current) return;
      syncingRef.current = true;
      dst.setScrollTop(src.getScrollTop());
      dst.setScrollLeft(src.getScrollLeft());
      setTimeout(() => {
        syncingRef.current = false;
      }, 0);
    };

    const d1 = original.onDidScrollChange(() => syncTo(original, modified));
    const d2 = modified.onDidScrollChange(() => syncTo(modified, original));
    return () => {
      d1.dispose();
      d2.dispose();
    };
  }, [syncScroll]);

  const canCompare = useMemo(() => canUseCompare && (leftQuery.trim() !== '' || rightQuery.trim() !== ''), [canUseCompare, leftQuery, rightQuery]);

  const handleUnified = async () => {
    if (!canCompare) return;
    const diff = await CompareQueries(normalizeSql(leftQuery), normalizeSql(rightQuery));
    setUnifiedDiff(diff);
    setShowUnified(true);
  };

  return (
    <OverlayDialog onClose={onClose} className="items-start pt-[8vh]">
      <div className="flex h-[84vh] w-[92vw] flex-col overflow-hidden rounded-md border border-border bg-card shadow-2xl">
        <div className="h-11 px-4 border-b border-border flex items-center justify-between">
          <div className="text-sm font-semibold text-foreground">Compare Queries</div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Checkbox checked={syncScroll} onCheckedChange={(checked) => setSyncScroll(checked === true)} />
              Sync scroll
            </label>
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Checkbox checked={ignoreWhitespace} onCheckedChange={(checked) => setIgnoreWhitespace(checked === true)} />
              Normalize whitespace
            </label>
            <Button variant="ghost" onClick={handleUnified} disabled={!canCompare}>
              Unified Diff
            </Button>
            <Button variant="ghost" onClick={onClose}>Close</Button>
          </div>
        </div>

        <div className="flex items-center gap-3 border-b border-border bg-muted/35 px-4 py-2">
            <label className="flex items-center gap-1 text-xs text-muted-foreground">
              Left
              <Select
                value={leftTabId}
                onValueChange={(value) => setLeftTabId(value)}
              >
                <SelectTrigger className="ml-1 min-w-[220px] text-[12px]" disabled={!canUseCompare}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {queryTabs.map((tab) => (
                    <SelectItem key={tab.id} value={tab.id}>
                      {tab.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label className="flex items-center gap-1 text-xs text-muted-foreground">
              Right
              <Select
                value={rightTabId}
                onValueChange={(value) => setRightTabId(value)}
              >
                <SelectTrigger className="ml-1 min-w-[220px] text-[12px]" disabled={!canUseCompare}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {queryTabs.map((tab) => (
                    <SelectItem key={tab.id} value={tab.id}>
                      {tab.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          <span className="text-[11px] text-muted-foreground">
            Deterministic source order by group/tab index
          </span>
          {!canUseCompare && (
            <span className="text-[11px] text-warning">
              Compare is not available for this license policy.
            </span>
          )}
        </div>

        <div className="flex-1 min-h-0">
          <DiffEditor
            original={normalizeSql(leftQuery)}
            modified={normalizeSql(rightQuery)}
            language="sql"
            theme="vs-dark"
            options={{
              automaticLayout: true,
              minimap: { enabled: false },
              renderOverviewRuler: true,
              scrollBeyondLastLine: false,
              ignoreTrimWhitespace: ignoreWhitespace,
            }}
            onMount={(editor: MonacoEditor.IStandaloneDiffEditor) => {
              const originalEditor = editor.getOriginalEditor();
              const modifiedEditor = editor.getModifiedEditor();
              originalRef.current = originalEditor;
              modifiedRef.current = modifiedEditor;
            }}
          />
        </div>

        {showUnified && (
          <div className="h-[35%] border-t border-border">
            <Editor
              height="100%"
              defaultLanguage="diff"
              value={unifiedDiff}
              theme="vs-dark"
              options={{ readOnly: true, minimap: { enabled: false }, automaticLayout: true }}
            />
          </div>
        )}
      </div>
    </OverlayDialog>
  );
};

