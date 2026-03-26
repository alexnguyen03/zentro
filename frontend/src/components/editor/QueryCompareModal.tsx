import React, { useEffect, useMemo, useRef, useState } from 'react';
import Editor, { DiffEditor } from '@monaco-editor/react';
import type { editor as MonacoEditor } from 'monaco-editor';
import { CompareQueries } from '../../services/queryService';
import { useEditorStore } from '../../stores/editorStore';
import { ModalBackdrop, Button } from '../ui';

interface QueryCompareModalProps {
  onClose: () => void;
}

export const QueryCompareModal: React.FC<QueryCompareModalProps> = ({ onClose }) => {
  const { groups, activeGroupId } = useEditorStore();
  const activeGroup = groups.find((g) => g.id === activeGroupId);
  const activeTab = activeGroup?.tabs.find((t) => t.id === activeGroup?.activeTabId);

  const [left, setLeft] = useState(activeTab?.query || '');
  const [right, setRight] = useState('');
  const [showUnified, setShowUnified] = useState(false);
  const [unifiedDiff, setUnifiedDiff] = useState('');
  const [syncScroll, setSyncScroll] = useState(true);

  const originalRef = useRef<MonacoEditor.ICodeEditor | null>(null);
  const modifiedRef = useRef<MonacoEditor.ICodeEditor | null>(null);
  const syncingRef = useRef(false);

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

  const canCompare = useMemo(() => left.trim() !== '' || right.trim() !== '', [left, right]);

  const handleUnified = async () => {
    if (!canCompare) return;
    const diff = await CompareQueries(left, right);
    setUnifiedDiff(diff);
    setShowUnified(true);
  };

  return (
    <ModalBackdrop onClose={onClose} className="items-start pt-[8vh]">
      <div className="w-[92vw] h-[84vh] bg-bg-secondary border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col">
        <div className="h-11 px-4 border-b border-border flex items-center justify-between">
          <div className="text-sm font-semibold">Compare Queries</div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-text-secondary flex items-center gap-1.5">
              <input type="checkbox" checked={syncScroll} onChange={(e) => setSyncScroll(e.target.checked)} />
              Sync scroll
            </label>
            <Button variant="ghost" onClick={handleUnified} disabled={!canCompare}>
              Unified Diff
            </Button>
            <Button variant="ghost" onClick={onClose}>Close</Button>
          </div>
        </div>

        <div className="flex-1 min-h-0">
          <DiffEditor
            original={left}
            modified={right}
            language="sql"
            theme="vs-dark"
            options={{
              automaticLayout: true,
              minimap: { enabled: false },
              renderOverviewRuler: true,
              scrollBeyondLastLine: false,
            }}
            onMount={(editor: MonacoEditor.IStandaloneDiffEditor) => {
              const originalEditor = editor.getOriginalEditor();
              const modifiedEditor = editor.getModifiedEditor();
              originalRef.current = originalEditor;
              modifiedRef.current = modifiedEditor;

              originalEditor.onDidChangeModelContent(() => setLeft(originalEditor.getValue()));
              modifiedEditor.onDidChangeModelContent(() => setRight(modifiedEditor.getValue()));
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
    </ModalBackdrop>
  );
};

