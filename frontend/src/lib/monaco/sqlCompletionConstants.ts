export const SQL_KEYWORDS = [
    'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'JOIN', 'INNER JOIN', 'LEFT JOIN', 'RIGHT JOIN',
    'OUTER JOIN', 'ON', 'GROUP BY', 'ORDER BY', 'HAVING', 'LIMIT', 'OFFSET', 'INSERT INTO',
    'VALUES', 'UPDATE', 'SET', 'DELETE FROM', 'CREATE TABLE', 'ALTER TABLE', 'DROP TABLE',
    'CREATE VIEW', 'DROP VIEW', 'CREATE INDEX', 'DROP INDEX', 'PRIMARY KEY', 'FOREIGN KEY',
    'AS', 'DISTINCT', 'UNION', 'ALL', 'IN', 'BETWEEN', 'LIKE', 'IS NULL', 'IS NOT NULL',
    'EXISTS', 'ANY', 'SOME', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'ASC', 'DESC', 'NULL', 'NOT',
    'WITH', 'DEFAULT', 'RETURNING', 'USING', 'EXPLAIN',
];

export const SQL_FUNCTIONS = [
    'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'COALESCE', 'CONCAT', 'SUBSTRING', 'LENGTH', 'UPPER',
    'LOWER', 'TRIM', 'NOW', 'DATE', 'CAST', 'ROUND', 'FLOOR', 'CEIL', 'ABS', 'CURRENT_TIMESTAMP',
];

export const SQL_OPERATORS = [
    '=', '<>', '!=', '>', '<', '>=', '<=', 'LIKE', 'IN', 'BETWEEN', 'IS NULL', 'IS NOT NULL',
];

export const DRIVER_SQL_KEYWORDS: Record<string, string[]> = {
    postgres: ['ILIKE', 'SIMILAR TO', 'SERIAL', 'BIGSERIAL', 'JSONB', 'UNNEST', 'LATERAL', 'ON CONFLICT'],
    mysql: ['REPLACE INTO', 'SHOW', 'DESCRIBE', 'AUTO_INCREMENT', 'ON DUPLICATE KEY UPDATE', 'ENGINE', 'UNSIGNED'],
    sqlserver: ['TOP', 'NVARCHAR', 'IDENTITY', 'MERGE', 'TRY_CONVERT', 'OUTPUT', 'WITH (NOLOCK)'],
    sqlite: ['PRAGMA', 'AUTOINCREMENT', 'WITHOUT ROWID', 'GLOB', 'VACUUM', 'ATTACH DATABASE'],
};

export const SELECT_LIKE_CLAUSES = new Set([
    'select',
    'where',
    'having',
    'groupBy',
    'orderBy',
    'on',
    'set',
    'createView',
]);

export const COLUMN_LIKE_CLAUSES = new Set([
    'select',
    'where',
    'having',
    'groupBy',
    'orderBy',
    'on',
    'set',
    'insertColumns',
    'createView',
]);

export const TABLE_LIKE_CLAUSES = new Set([
    'from',
    'join',
    'insert',
    'update',
    'delete',
]);
