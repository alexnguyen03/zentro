import { languages } from 'monaco-editor';
import { SchemaNode, useSchemaStore } from '../../stores/schemaStore';
import { useConnectionStore } from '../../stores/connectionStore';

const SQL_KEYWORDS = [
    'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'JOIN', 'INNER JOIN', 'LEFT JOIN', 'RIGHT JOIN',
    'OUTER JOIN', 'ON', 'GROUP BY', 'ORDER BY', 'HAVING', 'LIMIT', 'OFFSET', 'INSERT INTO',
    'VALUES', 'UPDATE', 'SET', 'DELETE FROM', 'CREATE TABLE', 'ALTER TABLE', 'DROP TABLE',
    'CREATE VIEW', 'DROP VIEW', 'CREATE INDEX', 'DROP INDEX', 'PRIMARY KEY', 'FOREIGN KEY',
    'AS', 'DISTINCT', 'UNION', 'ALL', 'IN', 'BETWEEN', 'LIKE', 'IS NULL', 'IS NOT NULL',
    'EXISTS', 'ANY', 'SOME', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'ASC', 'DESC', 'NULL', 'NOT'
];

const SQL_FUNCTIONS = [
    'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'COALESCE', 'CONCAT', 'SUBSTRING', 'LENGTH', 'UPPER',
    'LOWER', 'TRIM', 'NOW', 'DATE', 'CAST', 'ROUND', 'FLOOR', 'CEIL', 'ABS'
];

// Simple heuristic to extract table aliases from the query
// e.g. "FROM users u" -> Map<"u", "users">
function extractAliases(query: string): Map<string, string> {
    const aliasMap = new Map<string, string>();
    // Match "FROM table alias" or "JOIN table alias"
    // Does not cover all complex edge cases but handles standard queries well
    const regex = /(?:FROM|JOIN)\s+([a-zA-Z0-9_]+)\s+(?:AS\s+)?([a-zA-Z0-9_]+)/gi;
    let match;
    while ((match = regex.exec(query)) !== null) {
        // match[1] = table, match[2] = alias
        if (match[1].toUpperCase() !== 'SELECT') { // avoid subqueries for now
            aliasMap.set(match[2].toLowerCase(), match[1]);
        }
    }
    return aliasMap;
}

let completionDisposable: any = null;

export function registerContextAwareSQLCompletion(monaco: any) {
    if (completionDisposable) {
        completionDisposable.dispose();
    }

    completionDisposable = monaco.languages.registerCompletionItemProvider('sql', {
        triggerCharacters: ['.', ' '],
        provideCompletionItems: async (model: any, position: any, context: any) => {
            const word = model.getWordUntilPosition(position);
            const range = {
                startLineNumber: position.lineNumber,
                endLineNumber: position.lineNumber,
                startColumn: word.startColumn,
                endColumn: word.endColumn,
            };

            const fullQuery = model.getValue();
            const lineContent = model.getLineContent(position.lineNumber);
            const textBeforeCursor = lineContent.substring(0, position.column - 1);
            
            // Check if we just typed a dot (e.g. `alias.`)
            const isDotTrigger = textBeforeCursor.trim().endsWith('.');

            const profile = useConnectionStore.getState().activeProfile;
            const profileKey = profile?.name ?? '';
            const dbName = profile?.db_name ?? '';
            
            const trees = useSchemaStore.getState().trees;
            const checkAndFetchColumns = useSchemaStore.getState().checkAndFetchColumns;
            
            let allSchemas: SchemaNode[] = [];
            // Combine all schemas under the active profile
            Object.entries(trees).forEach(([key, schemas]) => {
                if (key.startsWith(profileKey)) {
                    allSchemas = allSchemas.concat(schemas || []);
                }
            });

            if (isDotTrigger) {
                // Determine what comes before the dot
                const match = textBeforeCursor.match(/([a-zA-Z0-9_]+)\.$/);
                if (match) {
                    const prefix = match[1];
                    const aliasMap = extractAliases(fullQuery);
                    
                    // prefix might be a table alias, or an exact table name
                    const tableName = aliasMap.get(prefix.toLowerCase()) || prefix;

                    // Find which schema this table belongs to
                    let targetSchema = '';
                    let foundTable = '';
                    
                    for (const s of allSchemas) {
                        const isTable = s.Tables?.find(t => t.toLowerCase() === tableName.toLowerCase());
                        const isView = s.Views?.find(v => v.toLowerCase() === tableName.toLowerCase());
                        if (isTable || isView) {
                            targetSchema = s.Name;
                            foundTable = isTable || isView || '';
                            break;
                        }
                    }

                    if (foundTable) {
                        // Fetch columns, utilizing cache
                        const columns = await checkAndFetchColumns(profileKey, dbName, targetSchema, foundTable);
                        if (columns && columns.length > 0) {
                            return {
                                suggestions: columns.map(col => ({
                                    label: col.Name,
                                    kind: monaco.languages.CompletionItemKind.Field,
                                    detail: col.DataType + (col.IsPrimaryKey ? ' (PK)' : ''),
                                    insertText: col.Name,
                                    range
                                }))
                            };
                        }
                    }
                }
                
                // If it's a dot but we cannot resolve columns, return empty
                // BUT Monaco caches these results tightly if we return INCOMPLETE: false
                // So if we have no suggestions for dot, returning an empty list makes it stop trying
                // until the next trigger. We'll return empty here.
                return { suggestions: [] };
            }

            // General suggestions (not after a dot)
            const suggestions: languages.CompletionItem[] = [];

            // Helper to see if the keyword matches the currently typed word
            const currentWordMatch = word.word.toUpperCase();

            // 1. Add Tables and Views
            allSchemas.forEach(schema => {
                (schema.Tables || []).forEach(t => {
                    suggestions.push({
                        label: t,
                        kind: monaco.languages.CompletionItemKind.Module, // Using Module for Tables
                        detail: 'Table',
                        insertText: t,
                        range
                    } as any);
                });
                (schema.Views || []).forEach(v => {
                    suggestions.push({
                        label: v,
                        kind: monaco.languages.CompletionItemKind.Class, // Using Class for Views
                        detail: 'View',
                        insertText: v,
                        range
                    } as any);
                });
            });

            // 2. Add SQL Keywords
            SQL_KEYWORDS.forEach(kw => {
                suggestions.push({
                    label: kw,
                    kind: monaco.languages.CompletionItemKind.Keyword,
                    insertText: kw,
                    // Provide score/sort order so keywords appear prominently
                    sortText: (kw.startsWith(currentWordMatch) ? '0' : '1') + kw,
                    range
                } as any);
            });

            // 3. Add SQL Functions
            SQL_FUNCTIONS.forEach(fn => {
                suggestions.push({
                    label: fn,
                    kind: monaco.languages.CompletionItemKind.Function,
                    insertText: `${fn}($1)`,
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    sortText: '2' + fn,
                    range
                } as any);
            });

            return { suggestions };
        }
    });
}
