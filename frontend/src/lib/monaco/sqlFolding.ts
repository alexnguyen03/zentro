import { languages } from 'monaco-editor';

type SqlFoldingRegisterMonacoApi = {
    languages: {
        registerFoldingRangeProvider: typeof languages.registerFoldingRangeProvider;
        FoldingRangeKind: typeof languages.FoldingRangeKind;
    };
};

type DisposableLike = { dispose: () => void };
const DISPOSABLE_KEY = '__ZENTRO_SQL_FOLDING_DISPOSABLE__';
type SqlFoldingWindow = Window & { [DISPOSABLE_KEY]?: DisposableLike };

const CLAUSE_PATTERNS: RegExp[] = [
    /^WITH\b/i,
    /^SELECT\b/i,
    /^INSERT\s+INTO\b/i,
    /^UPDATE\b/i,
    /^DELETE\s+FROM\b/i,
    /^FROM\b/i,
    /^WHERE\b/i,
    /^GROUP\s+BY\b/i,
    /^HAVING\b/i,
    /^ORDER\s+BY\b/i,
    /^LIMIT\b/i,
    /^OFFSET\b/i,
    /^UNION(?:\s+ALL)?\b/i,
    /^(LEFT|RIGHT|FULL|INNER|CROSS)\s+JOIN\b/i,
    /^JOIN\b/i,
    /^SET\b/i,
    /^VALUES\b/i,
];

function getStoredDisposable(): DisposableLike | undefined {
    return (window as SqlFoldingWindow)[DISPOSABLE_KEY];
}

function setStoredDisposable(disposable?: DisposableLike) {
    (window as SqlFoldingWindow)[DISPOSABLE_KEY] = disposable;
}

function isClauseStart(trimmed: string): boolean {
    return CLAUSE_PATTERNS.some((pattern) => pattern.test(trimmed));
}

function lineHasStatementTerminator(line: string): boolean {
    let inSingle = false;
    let inDouble = false;
    let inBacktick = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        const prev = i > 0 ? line[i - 1] : '';
        if (ch === '\'' && !inDouble && !inBacktick && prev !== '\\') {
            inSingle = !inSingle;
            continue;
        }
        if (ch === '"' && !inSingle && !inBacktick && prev !== '\\') {
            inDouble = !inDouble;
            continue;
        }
        if (ch === '`' && !inSingle && !inDouble && prev !== '\\') {
            inBacktick = !inBacktick;
            continue;
        }
        if (!inSingle && !inDouble && !inBacktick && ch === ';') {
            return true;
        }
    }
    return false;
}

export function registerSqlFolding(monaco: SqlFoldingRegisterMonacoApi) {
    const existing = getStoredDisposable();
    if (existing) {
        try {
            existing.dispose();
        } catch (error) {
            console.error('Error disposing SQL folding provider:', error);
        }
    }

    const registration = monaco.languages.registerFoldingRangeProvider('sql', {
        provideFoldingRanges: (model) => {
            const ranges: languages.FoldingRange[] = [];
            const lineCount = model.getLineCount();

            let statementStartLine = 0;
            let statementEndLine = 0;
            let clauseStarts: number[] = [];
            const seen = new Set<string>();

            const pushRange = (start: number, end: number) => {
                if (end <= start) return;
                const key = `${start}:${end}`;
                if (seen.has(key)) return;
                seen.add(key);
                ranges.push({
                    start,
                    end,
                    kind: monaco.languages.FoldingRangeKind.Region,
                });
            };

            const finalizeStatement = () => {
                if (!statementStartLine || !statementEndLine) return;

                pushRange(statementStartLine, statementEndLine);

                for (let i = 0; i < clauseStarts.length; i++) {
                    const start = clauseStarts[i];
                    const nextStart = clauseStarts[i + 1] || statementEndLine + 1;
                    const end = Math.min(statementEndLine, nextStart - 1);
                    pushRange(start, end);
                }
            };

            for (let line = 1; line <= lineCount; line++) {
                const content = model.getLineContent(line);
                const trimmed = content.trim();
                if (!trimmed) continue;

                if (!statementStartLine) {
                    statementStartLine = line;
                }
                statementEndLine = line;

                if (isClauseStart(trimmed)) {
                    clauseStarts.push(line);
                }

                if (lineHasStatementTerminator(content)) {
                    finalizeStatement();
                    statementStartLine = 0;
                    statementEndLine = 0;
                    clauseStarts = [];
                }
            }

            finalizeStatement();
            return ranges;
        },
    });

    setStoredDisposable(registration as DisposableLike);
}

