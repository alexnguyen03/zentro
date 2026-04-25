import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FileCode } from 'lucide-react';
import { useScriptStore } from '../../stores/scriptStore';
import { CommandItem } from '../ui';

function formatDate(iso: string): string {
    try {
        return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
        return '';
    }
}

export function highlightMatch(text: string, keyword: string): React.ReactNode {
    if (!keyword.trim()) return text;
    const idx = text.toLowerCase().indexOf(keyword.toLowerCase());
    if (idx === -1) return text;
    return (
        <>
            {text.slice(0, idx)}
            <mark className="bg-warning/35 text-foreground not-italic rounded-[2px] px-0">
                {text.slice(idx, idx + keyword.length)}
            </mark>
            {text.slice(idx + keyword.length)}
        </>
    );
}

export function getMatchedLines(content: string, keyword: string, max = 3): string[] {
    if (!keyword.trim()) return [];
    const kw = keyword.toLowerCase();
    return content
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0 && l.toLowerCase().includes(kw))
        .slice(0, max);
}

export function getFirstMeaningfulLine(content: string): string {
    const lines = content.split('\n').map((l) => l.trim()).filter(Boolean);
    return lines.find((l) => !l.startsWith('--') && !l.startsWith('/*')) ?? lines[0] ?? '';
}

interface ScriptSearchResultsProps {
    query: string;
    projectId: string;
    connectionName: string;
    onOpen: (scriptId: string, scriptName: string, content: string) => void;
}

export const ScriptSearchResults: React.FC<ScriptSearchResultsProps> = ({
    query,
    projectId,
    connectionName,
    onOpen,
}) => {
    const { scripts, getContent } = useScriptStore();
    const [contentCache, setContentCache] = useState<Map<string, string>>(new Map());
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        if (!projectId || !connectionName || scripts.length === 0) {
            setIsReady(true);
            return;
        }
        let cancelled = false;
        Promise.all(
            scripts.map(async (s) => [s.id, await getContent(projectId, connectionName, s.id)] as const),
        )
            .then((entries) => {
                if (!cancelled) {
                    setContentCache(new Map(entries));
                    setIsReady(true);
                }
            })
            .catch(() => {
                if (!cancelled) setIsReady(true);
            });
        return () => {
            cancelled = true;
        };
    }, [scripts, projectId, connectionName, getContent]);

    const results = useMemo(() => {
        const kw = query.trim().toLowerCase();
        if (!kw) return scripts.slice(0, 30);
        return scripts
            .filter((s) => {
                if (s.name.toLowerCase().includes(kw)) return true;
                return (contentCache.get(s.id) ?? '').toLowerCase().includes(kw);
            })
            .slice(0, 30);
    }, [scripts, contentCache, query]);

    const handleSelect = useCallback(
        (scriptId: string, scriptName: string) => {
            onOpen(scriptId, scriptName, contentCache.get(scriptId) ?? '');
        },
        [contentCache, onOpen],
    );

    if (!isReady && scripts.length > 0) {
        return (
            <div className="px-4 py-2 text-label text-muted-foreground">Loading script content...</div>
        );
    }

    if (results.length === 0) {
        return <div className="px-4 py-2 text-label text-muted-foreground">No scripts found</div>;
    }

    return (
        <div className="py-1">
            {results.map((script) => {
                const content = contentCache.get(script.id) ?? '';
                const kw = query.trim();
                const matchedLines = getMatchedLines(content, kw);
                const nameMatch = kw ? script.name.toLowerCase().includes(kw.toLowerCase()) : false;
                return (
                    <CommandItem
                        key={script.id}
                        value={`script:${script.id}:${script.name}`}
                        onSelect={() => handleSelect(script.id, script.name)}
                        className="flex flex-col items-start gap-0.5 px-4 py-1.5 cursor-pointer data-[selected=true]:bg-primary/10"
                    >
                        <div className="flex w-full items-center gap-2">
                            <FileCode size={13} className="shrink-0 text-success opacity-80" />
                            <span className="flex-1 truncate text-small font-medium text-foreground">
                                {nameMatch ? highlightMatch(script.name, kw) : script.name}
                            </span>
                            <span className="shrink-0 text-label text-muted-foreground">
                                {formatDate(String(script.updated_at ?? ''))}
                            </span>
                        </div>
                        {matchedLines.map((line, i) => (
                            <div key={i} className="w-full pl-5 truncate font-mono text-label text-muted-foreground/85">
                                {highlightMatch(line, kw)}
                            </div>
                        ))}
                    </CommandItem>
                );
            })}
        </div>
    );
};
