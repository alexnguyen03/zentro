import { languages } from 'monaco-editor';
import { getTypesForDriver } from '../dbTypes';
import {
    COLUMN_LIKE_CLAUSES,
    DRIVER_SQL_KEYWORDS,
    SELECT_LIKE_CLAUSES,
    SQL_FUNCTIONS,
    SQL_KEYWORDS,
    SQL_OPERATORS,
    TABLE_LIKE_CLAUSES,
} from './sqlCompletionConstants';
import {
    buildCatalogIndex,
    findPreferredCatalogMatches,
    resolveColumnsForSources,
    resolveSourcesFromIdentifier,
} from './sqlCompletionCatalog';
import { generateAliasFromObjectName, normalizeDriverKey, normalizeIdentifier, quoteIdentifierForDriver } from './sqlCompletionIdentifiers';
import {
    buildSelectLikeSuggestions,
    finalizeSuggestions,
    makeSortText,
    normalizeInsertClause,
} from './sqlCompletionBuilderUtils';
import { buildJoinSuggestionItems } from './sqlCompletionJoinSuggestions';
import { SQL_COMPLETION_TABLE_SELECTED_COMMAND_ID } from './sqlSuggestionSchemaContext';
import { TableCompletionItem } from './sqlSuggestionTableDocs';
import { CompletionKind, SqlAnalysis, SqlCompletionBuildOptions, SqlCompletionEnv, SuggestionRecord, SqlSourceRef } from './sqlCompletionTypes';

const STATEMENT_STARTER_KEYWORDS = new Set([
    'SELECT',
    'INSERT INTO',
    'UPDATE',
    'DELETE FROM',
    'CREATE TABLE',
    'ALTER TABLE',
    'DROP TABLE',
    'CREATE VIEW',
    'DROP VIEW',
    'CREATE INDEX',
    'DROP INDEX',
    'WITH',
    'EXPLAIN',
]);

export async function buildSqlCompletionItems(
    analysis: SqlAnalysis,
    currentWord: string,
    range: { startLineNumber: number; endLineNumber: number; startColumn: number; endColumn: number },
    env: SqlCompletionEnv,
    options: SqlCompletionBuildOptions = {},
): Promise<languages.CompletionItem[]> {
    const shouldAbort = options.shouldAbort ?? (() => false);
    if (analysis.isInCommentOrString || shouldAbort()) return [];

    const suggestionMap = new Map<string, SuggestionRecord>();
    const currentWordNorm = normalizeIdentifier(currentWord);
    const currentWordLower = currentWordNorm.toLowerCase();
    const resolvePrefixBoost = (label: string, kind?: CompletionKind): number => {
        const labelNorm = normalizeIdentifier(label).toLowerCase();
        const keywordKind = env.monaco.languages.CompletionItemKind.Keyword as CompletionKind;
        const functionKind = env.monaco.languages.CompletionItemKind.Function as CompletionKind;
        const fieldKind = env.monaco.languages.CompletionItemKind.Field as CompletionKind;
        const moduleKind = env.monaco.languages.CompletionItemKind.Module as CompletionKind;
        const classKind = env.monaco.languages.CompletionItemKind.Class as CompletionKind;
        const textKind = env.monaco.languages.CompletionItemKind.Text as CompletionKind;
        const snippetKind = env.monaco.languages.CompletionItemKind.Snippet as CompletionKind;
        const operatorKind = env.monaco.languages.CompletionItemKind.Operator as CompletionKind;
        const prefixMatch = Boolean(currentWordLower) && labelNorm.startsWith(currentWordLower);
        if (prefixMatch) {
            if (kind === moduleKind || kind === classKind) return -1100;
            if (kind === keywordKind) return -1000;
            if (kind === functionKind) return -900;
            if (kind === fieldKind) return -800;
            if (kind === operatorKind) return -600;
            if (kind === snippetKind) return -500;
            if (kind === textKind) return -400;
            return -300;
        }
        if (kind === textKind) return 250;
        if (kind === snippetKind) return 150;
        if (kind === operatorKind) return 120;
        if (kind === moduleKind || kind === classKind) return 60;
        if (kind === fieldKind) return 90;
        if (kind === functionKind) return 70;
        return 0;
    };
    const resolveLabel = (label: languages.CompletionItem['label']): string => {
        if (typeof label === 'string') return label;
        return label?.label || '';
    };
    const applyStatementTerminatorForUnknownClause = (items: languages.CompletionItem[]): languages.CompletionItem[] => {
        if (baseClause !== 'unknown') return items;

        return items.map((item) => {
            const label = resolveLabel(item.label).toUpperCase();
            if (!STATEMENT_STARTER_KEYWORDS.has(label)) return item;

            const insertText = typeof item.insertText === 'string' ? item.insertText : label;
            if (!insertText || /;\s*$/.test(insertText)) return item;

            const insertTextWithoutSemicolon = insertText.replace(/\s*;+\s*$/, '').trimEnd();
            if (!insertTextWithoutSemicolon) return item;
            const spacedInsertText = `${insertTextWithoutSemicolon} `;

            return {
                ...item,
                insertText: `${spacedInsertText}$0;`,
                insertTextRules: env.monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            };
        });
    };
    const clause = normalizeInsertClause(analysis);
    const baseClause = clause === 'insertColumns' ? 'select' : clause;

    const addSuggestion = (label: string, item: languages.CompletionItem, priority: number) => {
        const key = normalizeIdentifier(label);
        const resolvedPriority = priority + resolvePrefixBoost(label, item.kind as CompletionKind);
        const existing = suggestionMap.get(key);
        if (!existing || resolvedPriority < existing.priority) {
            suggestionMap.set(key, { priority: resolvedPriority, item: { ...item, sortText: makeSortText(resolvedPriority, label) } });
        }
    };
    const addKeyword = (label: string, insertText = `${label} `, priority = 200) => addSuggestion(label, { label, kind: env.monaco.languages.CompletionItemKind.Keyword as CompletionKind, insertText, range }, priority);
    const addFunction = (label: string, snippet = `${label}($1)`, priority = 200) =>
        addSuggestion(label, { label, kind: env.monaco.languages.CompletionItemKind.Function as CompletionKind, insertText: snippet, insertTextRules: env.monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range }, priority);
    const addOperator = (label: string, insertText = label, priority = 50) => addSuggestion(label, { label, kind: env.monaco.languages.CompletionItemKind.Operator as CompletionKind, insertText, range }, priority);
    const addText = (label: string, insertText = label, priority = 500) => addSuggestion(label, { label, kind: env.monaco.languages.CompletionItemKind.Text as CompletionKind, insertText, range }, priority);

    const addTemplates = () => env.templates.forEach((template) => {
        addSuggestion(template.trigger, { label: template.trigger, kind: env.monaco.languages.CompletionItemKind.Snippet as CompletionKind, detail: template.name, documentation: template.content, insertText: template.content, insertTextRules: env.monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range }, 240);
    });
    const addBaselineKeywords = () => {
        SQL_KEYWORDS.forEach((keyword) => addKeyword(keyword, keyword, 260));
        const driverKey = normalizeDriverKey(env.driver);
        (DRIVER_SQL_KEYWORDS[driverKey] || []).forEach((keyword) => addKeyword(keyword, keyword, 255));
    };

    const inferSourceSchemaName = (source: SqlSourceRef): string => {
        if (source.schemaName) return normalizeIdentifier(source.schemaName);
        if (!(source.kind === 'table' || source.kind === 'view')) return '';
        const matches = findPreferredCatalogMatches(
            env.schemas,
            source.name,
            undefined,
            env.currentSchema,
        );
        if (matches.length === 0) return '';
        const preferredKind = source.kind === 'view' ? 'view' : 'table';
        const preferredMatches = matches.filter((match) => match.kind === preferredKind);
        if (preferredMatches.length === 1) return normalizeIdentifier(preferredMatches[0].schemaName);
        if (preferredMatches.length === 0 && matches.length === 1) return normalizeIdentifier(matches[0].schemaName);
        return '';
    };

    const statementSchemaContext = (() => {
        const schemas = new Set<string>();
        analysis.sources.forEach((source) => {
            const inferred = inferSourceSchemaName(source);
            if (inferred) schemas.add(inferred);
        });
        return schemas;
    })();
    const currentSchemaFromState = normalizeIdentifier(env.currentSchema || '');
    const effectiveContextSchema = statementSchemaContext.size === 1
        ? Array.from(statementSchemaContext)[0]
        : statementSchemaContext.size === 0
            ? currentSchemaFromState
            : '';

    const shouldAppendTerminatorForInitialSelectFrom = (() => {
        if (baseClause !== 'from') return false;
        const normalized = analysis.statementText.trim().replace(/\s+/g, ' ').toLowerCase();
        return normalized.startsWith('select * from ');
    })();

    const buildTableItems = (options?: { withAlias?: boolean; appendTerminator?: boolean }) => {
        const catalog = buildCatalogIndex(env.schemas);
        const items: Array<{ item: TableCompletionItem; priority: number }> = [];
        for (const entry of catalog.entries) {
            const label = entry.duplicateCount > 1 ? `${entry.schemaName}.${entry.name}` : entry.name;
            const detail = `${entry.kind === 'view' ? 'View' : 'Table'} - ${entry.schemaName}`;
            const entrySchema = normalizeIdentifier(entry.schemaName);
            const forceQualifiedBySchema = entry.duplicateCount > 1
                && (!effectiveContextSchema || effectiveContextSchema !== entrySchema);
            const qualifiedName = forceQualifiedBySchema
                ? `${quoteIdentifierForDriver(entry.schemaName, env.driver, true)}.${quoteIdentifierForDriver(entry.name, env.driver, true)}`
                : quoteIdentifierForDriver(entry.name, env.driver);
            const alias = options?.withAlias ? generateAliasFromObjectName(entry.name) : '';
            const insertTextBase = alias ? `${qualifiedName} ${alias}` : qualifiedName;
            const insertText = options?.appendTerminator ? `${insertTextBase};` : insertTextBase;
            items.push({
                priority: 100,
                item: {
                    label,
                    kind: entry.kind === 'view' ? env.monaco.languages.CompletionItemKind.Class as CompletionKind : env.monaco.languages.CompletionItemKind.Module as CompletionKind,
                    detail,
                    insertText,
                    range,
                    command: {
                        id: SQL_COMPLETION_TABLE_SELECTED_COMMAND_ID,
                        title: 'set sql schema context',
                        arguments: [{
                            schemaName: entry.schemaName,
                        }],
                    },
                    __zentroTableMeta: {
                        schemaName: entry.schemaName,
                        tableName: entry.name,
                        objectKind: entry.kind,
                        profileKey: env.profileKey || '',
                        dbName: env.dbName || '',
                        driver: env.driver || '',
                    },
                },
            });
        }
        return items;
    };

    const buildColumnItems = async (sources: SqlSourceRef[]) => {
        const resolvedColumns = await resolveColumnsForSources(sources, analysis, env, shouldAbort);
        if (shouldAbort()) return [];
        return resolvedColumns.map((column) => ({
            label: column.Name,
            kind: env.monaco.languages.CompletionItemKind.Field as CompletionKind,
            detail: column.DataType || column.detail || '',
            insertText: column.Name,
            range,
        }));
    };

    const buildAliasItems = (sources: SqlSourceRef[]) => {
        const uniqueAliases = new Set<string>();
        const items: Array<{ label: string; kind: CompletionKind; detail: string; insertText: string; range: typeof range }> = [];

        sources.slice(0, 8).forEach((source) => {
            const alias = (source.alias || source.name || '').trim();
            if (!alias) return;
            const key = normalizeIdentifier(alias);
            if (!key || uniqueAliases.has(key)) return;
            uniqueAliases.add(key);
            items.push({
                label: alias,
                kind: env.monaco.languages.CompletionItemKind.Text as CompletionKind,
                detail: 'Alias',
                insertText: `${alias}.`,
                range,
            });
        });

        return items;
    };

    const buildAliasQualifiedColumnItems = async (sources: SqlSourceRef[]) => {
        const unique = new Map<string, { label: string; kind: CompletionKind; detail: string; insertText: string; range: typeof range }>();
        const targetSources = sources.slice(0, 8);

        for (const source of targetSources) {
            if (shouldAbort()) return [];
            const alias = (source.alias || source.name || '').trim();
            if (!alias) continue;
            const aliasNorm = normalizeIdentifier(alias);
            if (!aliasNorm) continue;

            if (source.columns && source.columns.length > 0) {
                source.columns.forEach((columnName) => {
                    const label = `${alias}.${columnName}`;
                    const key = normalizeIdentifier(label);
                    if (!unique.has(key)) {
                        unique.set(key, {
                            label,
                            kind: env.monaco.languages.CompletionItemKind.Field as CompletionKind,
                            detail: `Column - ${alias}`,
                            insertText: label,
                            range,
                        });
                    }
                });
                continue;
            }

            if (source.kind === 'cte' || source.kind === 'subquery') continue;
            const matches = findPreferredCatalogMatches(
                env.schemas,
                source.name,
                source.schemaName,
                env.currentSchema,
            );
            for (const match of matches) {
                if (shouldAbort()) return [];
                const columns = await env.fetchColumns(match.schemaName, match.name);
                if (shouldAbort()) return [];
                columns.forEach((column) => {
                    const label = `${alias}.${column.Name}`;
                    const key = normalizeIdentifier(label);
                    if (!unique.has(key)) {
                        unique.set(key, {
                            label,
                            kind: env.monaco.languages.CompletionItemKind.Field as CompletionKind,
                            detail: column.DataType ? `${column.DataType} - ${alias}` : `Column - ${alias}`,
                            insertText: label,
                            range,
                        });
                    }
                });
            }
        }

        return Array.from(unique.values()).sort((a, b) => a.label.localeCompare(b.label));
    };

    addBaselineKeywords();
    if (shouldAbort()) return [];
    if (env.schemas.length === 0) {
        addTemplates();
        if (shouldAbort()) return [];
        return applyStatementTerminatorForUnknownClause(finalizeSuggestions(suggestionMap));
    }

    if (analysis.afterDot) {
        const dotSources = resolveSourcesFromIdentifier(analysis.dotIdentifier, analysis.sources, analysis.ctes, env.schemas);
        const columns = await buildColumnItems(dotSources.length > 0 ? dotSources : analysis.sources);
        if (shouldAbort()) return [];
        columns.forEach((item) => addSuggestion(item.label as string, item, 0));
        return finalizeSuggestions(suggestionMap);
    }

    if (COLUMN_LIKE_CLAUSES.has(baseClause)) {
        const isFilteringClause = baseClause === 'where' || baseClause === 'having' || baseClause === 'on' || baseClause === 'set';
        const bareColumnSources = isFilteringClause ? analysis.sources.filter(s => !s.alias) : analysis.sources;
        const columns = await buildColumnItems(bareColumnSources);
        if (shouldAbort()) return [];
        columns.forEach((item) => addSuggestion(item.label as string, item, 0));
    }
    if (SELECT_LIKE_CLAUSES.has(baseClause) || baseClause === 'with' || baseClause === 'unknown') {
        const columns = analysis.sources.length > 0 ? await buildColumnItems(analysis.sources) : [];
        if (shouldAbort()) return [];
        columns.forEach((item) => addSuggestion(item.label as string, item, 0));
        addTemplates(); buildSelectLikeSuggestions(addKeyword, addFunction, addText, addOperator);
        addText('*', '*', 10); addKeyword('DISTINCT', 'DISTINCT ', 15); addKeyword('FROM', 'FROM ', 20);
    }
    if (TABLE_LIKE_CLAUSES.has(baseClause)) {
        const withAlias = baseClause === 'from' || baseClause === 'join';
        buildTableItems({
            withAlias,
            appendTerminator: shouldAppendTerminatorForInitialSelectFrom,
        }).forEach((record) => addSuggestion(record.item.label as string, record.item, record.priority));
        addKeyword('AS', 'AS ', 130);
        if (baseClause === 'insert') { addKeyword('VALUES', 'VALUES ', 120); addKeyword('DEFAULT VALUES', 'DEFAULT VALUES', 110); }
        if (baseClause === 'delete') addKeyword('WHERE', 'WHERE ', 140);
    }
    if (baseClause === 'from' || baseClause === 'join' || baseClause === 'on') {
        const joinSuggestions = await buildJoinSuggestionItems(analysis, baseClause, currentWord, range, env, shouldAbort);
        if (shouldAbort()) return [];
        joinSuggestions.forEach((record) => addSuggestion(record.label, record.item, record.priority));
    }
    if (baseClause === 'where' || baseClause === 'having' || baseClause === 'on' || baseClause === 'set') {
        const unaliasedSources = analysis.sources.filter(s => !s.alias);
        const columns = await buildColumnItems(unaliasedSources);
        if (shouldAbort()) return [];
        const aliases = buildAliasItems(analysis.sources);
        const aliasColumns = await buildAliasQualifiedColumnItems(analysis.sources);
        if (shouldAbort()) return [];
        columns.forEach((item) => addSuggestion(item.label as string, item, 0));
        aliases.forEach((item) => addSuggestion(item.label, item, -25));
        aliasColumns.forEach((item) => addSuggestion(item.label, item, -10));
        SQL_OPERATORS.forEach((op) => addOperator(op, `${op} `, 50));
        buildSelectLikeSuggestions(addKeyword, addFunction, addText, addOperator);
    }
    if (baseClause === 'groupBy' || baseClause === 'orderBy') {
        const columns = await buildColumnItems(analysis.sources);
        if (shouldAbort()) return [];
        columns.forEach((item) => addSuggestion(item.label as string, item, 0));
        SQL_FUNCTIONS.forEach((fn) => addFunction(fn, `${fn}($1)`, 100));
        addKeyword('ASC', 'ASC ', 20); addKeyword('DESC', 'DESC ', 20);
    }
    if (baseClause === 'createTable' || baseClause === 'alterTable') {
        const types = getTypesForDriver(env.driver);
        types.forEach((type) => addSuggestion(type, { label: type, kind: env.monaco.languages.CompletionItemKind.Keyword as CompletionKind, insertText: type, range }, 0));
        ['PRIMARY KEY', 'FOREIGN KEY', 'NOT NULL', 'DEFAULT', 'UNIQUE', 'CHECK', 'REFERENCES'].forEach((kw) => addKeyword(kw, kw, 100));
        if (baseClause === 'alterTable') ['ADD COLUMN', 'DROP COLUMN', 'RENAME COLUMN', 'ALTER COLUMN'].forEach((kw) => addKeyword(kw, kw, 90));
    }
    if (baseClause === 'values') {
        ['NULL', 'DEFAULT', 'CURRENT_TIMESTAMP'].forEach((kw) => addKeyword(kw, `${kw} `, 80));
        ['TRUE', 'FALSE'].forEach((kw) => addKeyword(kw, kw, 90));
        SQL_FUNCTIONS.forEach((fn) => addFunction(fn, `${fn}($1)`, 120));
    }
    if (baseClause === 'select' && analysis.sources.length === 0) buildTableItems().forEach((record) => addSuggestion(record.item.label as string, record.item, record.priority + 40));
    if (baseClause === 'unknown') addTemplates();
    if (shouldAbort()) return [];
    return applyStatementTerminatorForUnknownClause(finalizeSuggestions(suggestionMap));
}
