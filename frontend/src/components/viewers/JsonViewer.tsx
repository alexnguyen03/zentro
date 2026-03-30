import React, { useState, useMemo, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { Copy, Check } from 'lucide-react';
import type { editor as MonacoEditor } from 'monaco-editor';
import { useSettingsStore } from '../../stores/settingsStore';
import { setClipboardText } from '../../services/clipboardService';

interface JsonViewerProps {
    value: string;
    className?: string;
    showCopy?: boolean;
    height?: string;
    useMonaco?: boolean;
}

const isJson = (val: string): boolean => {
    if (!val || typeof val !== 'string') return false;
    const trimmed = val.trim();
    // Not JSON if it's a base64 image
    if (trimmed.startsWith('data:image/')) return false;
    // Not JSON if it's long base64 string
    if (/^[A-Za-z0-9+/=]{20,}$/.test(trimmed)) return false;
    // Not JSON if it looks like a filename
    if (/\.(png|jpg|jpeg|gif|svg|webp|bmp)$/i.test(trimmed)) return false;
    return (trimmed.startsWith('{') && trimmed.endsWith('}')) || 
           (trimmed.startsWith('[') && trimmed.endsWith(']'));
};

const formatJson = (val: string): string => {
    try {
        return JSON.stringify(JSON.parse(val), null, 2);
    } catch {
        return val;
    }
};

// Simple JSON viewer without Monaco - for inline use
const SimpleJsonView: React.FC<{ value: string; showCopy?: boolean }> = ({ value, showCopy }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        try {
            await setClipboardText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    return (
        <div className="simple-json-view">
            {showCopy && (
                <button 
                    className="json-copy-btn" 
                    onClick={handleCopy}
                    title="Copy JSON"
                >
                    {copied ? <Check size={12} className="text-success" /> : <Copy size={12} />}
                </button>
            )}
            <pre className="simple-json-content">{value}</pre>
        </div>
    );
};

export const JsonViewer: React.FC<JsonViewerProps> = ({ value, className = '', showCopy = true, height = '100%', useMonaco = true }) => {
    const [copied, setCopied] = useState(false);
    const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
    const { theme } = useSettingsStore();

    const isValidJson = isJson(value);
    const formattedValue = useMemo(() => {
        if (!isValidJson) return value;
        return formatJson(value);
    }, [value, isValidJson]);

    const handleCopy = async () => {
        try {
            await setClipboardText(formattedValue);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    const handleEditorMount = (editor: MonacoEditor.IStandaloneCodeEditor) => {
        editorRef.current = editor;
    };

    if (!isValidJson) {
        return <span className={className}>{value}</span>;
    }

    // Use simple view for inline (small containers)
    if (!useMonaco) {
        return (
            <SimpleJsonView value={formattedValue} showCopy={showCopy} />
        );
    }

    return (
        <div className={`json-viewer ${className}`} style={{ height }}>
            {showCopy && (
                <div className="json-toolbar">
                    <button 
                        className="json-copy-btn" 
                        onClick={handleCopy}
                        title="Copy JSON"
                    >
                        {copied ? <Check size={12} className="text-success" /> : <Copy size={12} />}
                    </button>
                </div>
            )}
            <div className="json-content" style={{ height: showCopy ? 'calc(100% - 32px)' : '100%' }}>
                <Editor
                    height="100%"
                    language="json"
                    value={formattedValue}
                    theme={theme === 'dark' ? 'vs-dark' : 'light'}
                    onMount={handleEditorMount}
                    options={{
                        readOnly: true,
                        minimap: { enabled: false },
                        lineNumbers: 'on',
                        scrollBeyondLastLine: false,
                        folding: true,
                        wordWrap: 'on',
                        automaticLayout: true,
                        fontSize: 11,
                        fontFamily: 'var(--font-mono, monospace)',
                        scrollbar: {
                            verticalScrollbarSize: 8,
                            horizontalScrollbarSize: 8,
                        },
                        overviewRulerLanes: 0,
                        hideCursorInOverviewRuler: true,
                        overviewRulerBorder: false,
                        renderLineHighlight: 'none',
                        contextmenu: true,
                        quickSuggestions: false,
                        suggestOnTriggerCharacters: false,
                        parameterHints: { enabled: false },
                        tabSize: 2,
                    }}
                />
            </div>
        </div>
    );
};

export const isJsonValue = (val: string): boolean => isJson(val);
