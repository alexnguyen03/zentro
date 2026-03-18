// Lightweight SQL DDL syntax highlighter — no external dependencies.
// Returns an HTML string with <span> tags for coloring.

const KEYWORDS = new Set([
    'CREATE', 'TABLE', 'VIEW', 'INDEX', 'DROP', 'ALTER', 'ADD', 'COLUMN',
    'PRIMARY', 'KEY', 'FOREIGN', 'REFERENCES', 'UNIQUE', 'NOT', 'NULL',
    'DEFAULT', 'CONSTRAINT', 'CHECK', 'ON', 'DELETE', 'UPDATE', 'CASCADE',
    'SET', 'RESTRICT', 'IF', 'EXISTS', 'ENGINE', 'CHARSET', 'COLLATE',
    'WITH', 'AS', 'SCHEMA', 'DATABASE', 'OR', 'REPLACE', 'TEMPORARY',
    'MATERIALIZED', 'CLUSTERED', 'NONCLUSTERED', 'INCLUDE', 'WHERE',
    'IDENTITY', 'AUTO_INCREMENT', 'SERIAL', 'SEQUENCE', 'NEXTVAL',
    'BEGIN', 'END', 'GO',
]);

const TYPES = new Set([
    'INT', 'INTEGER', 'BIGINT', 'SMALLINT', 'TINYINT', 'MEDIUMINT',
    'VARCHAR', 'CHAR', 'TEXT', 'TINYTEXT', 'MEDIUMTEXT', 'LONGTEXT', 'NVARCHAR', 'NCHAR',
    'BOOLEAN', 'BOOL', 'BIT',
    'FLOAT', 'DOUBLE', 'REAL', 'DECIMAL', 'NUMERIC', 'MONEY', 'SMALLMONEY',
    'DATE', 'TIME', 'DATETIME', 'DATETIME2', 'TIMESTAMP', 'TIMESTAMPTZ', 'INTERVAL',
    'BLOB', 'BYTEA', 'BINARY', 'VARBINARY', 'IMAGE',
    'JSON', 'JSONB', 'XML', 'UUID', 'OID',
    'SERIAL', 'BIGSERIAL', 'SMALLSERIAL',
    'PRECISION', 'VARYING', 'ZONE', 'WITHOUT',
]);

function escapeHtml(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

type TokenType = 'keyword' | 'type' | 'string' | 'number' | 'comment' | 'punct' | 'plain';

interface Token {
    type: TokenType;
    value: string;
}

function tokenize(sql: string): Token[] {
    const tokens: Token[] = [];
    let i = 0;

    while (i < sql.length) {
        // Single-line comment
        if (sql[i] === '-' && sql[i + 1] === '-') {
            let j = i;
            while (j < sql.length && sql[j] !== '\n') j++;
            tokens.push({ type: 'comment', value: sql.slice(i, j) });
            i = j;
            continue;
        }

        // Block comment
        if (sql[i] === '/' && sql[i + 1] === '*') {
            let j = i + 2;
            while (j < sql.length && !(sql[j] === '*' && sql[j + 1] === '/')) j++;
            j += 2;
            tokens.push({ type: 'comment', value: sql.slice(i, j) });
            i = j;
            continue;
        }

        // String literals: single quote
        if (sql[i] === "'") {
            let j = i + 1;
            while (j < sql.length && sql[j] !== "'") {
                if (sql[j] === '\\') j++;
                j++;
            }
            j++;
            tokens.push({ type: 'string', value: sql.slice(i, j) });
            i = j;
            continue;
        }

        // Number
        if (/[0-9]/.test(sql[i]) || (sql[i] === '-' && /[0-9]/.test(sql[i + 1] ?? ''))) {
            let j = i;
            if (sql[j] === '-') j++;
            while (j < sql.length && /[0-9.]/.test(sql[j])) j++;
            tokens.push({ type: 'number', value: sql.slice(i, j) });
            i = j;
            continue;
        }

        // Identifier or keyword
        if (/[a-zA-Z_]/.test(sql[i])) {
            let j = i;
            while (j < sql.length && /[a-zA-Z0-9_]/.test(sql[j])) j++;
            const word = sql.slice(i, j);
            const upper = word.toUpperCase();
            let type: TokenType = 'plain';
            if (KEYWORDS.has(upper)) type = 'keyword';
            else if (TYPES.has(upper)) type = 'type';
            tokens.push({ type, value: word });
            i = j;
            continue;
        }

        // Punctuation
        if (/[(),;.]/.test(sql[i])) {
            tokens.push({ type: 'punct', value: sql[i] });
            i++;
            continue;
        }

        // Whitespace and anything else — plain
        let j = i;
        while (j < sql.length && !/[a-zA-Z0-9_'"()\-/,;. \t\n\r]/.test(sql[j])) j++;
        if (j === i) j++;
        tokens.push({ type: 'plain', value: sql.slice(i, j) });
        i = j;
    }

    return tokens;
}

const COLOR_MAP: Record<TokenType, string> = {
    keyword: 'var(--color-accent)',
    type:    'var(--color-success)',
    string:  'var(--color-warning, #e6a817)',
    number:  'var(--color-warning, #e6a817)',
    comment: 'var(--color-text-secondary)',
    punct:   'var(--color-text-secondary)',
    plain:   'var(--color-text-primary)',
};

export function highlightSQL(sql: string): string {
    const tokens = tokenize(sql);
    return tokens
        .map(({ type, value }) => {
            const color = COLOR_MAP[type];
            const escaped = escapeHtml(value);
            if (type === 'plain') return escaped;
            return `<span style="color:${color}">${escaped}</span>`;
        })
        .join('');
}
