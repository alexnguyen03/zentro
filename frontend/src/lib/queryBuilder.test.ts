import { describe, expect, it } from 'vitest';
import { buildFilterOrderQuery, buildFilterQuery } from './queryBuilder';

describe('buildFilterQuery', () => {
    it('adds WHERE when current query has no WHERE clause', () => {
        const query = 'SELECT  * FROM  "inv"."inventory_document_header" idh';
        const filter = 'document_id = 12 ';

        expect(buildFilterQuery(query, filter)).toBe(
            'SELECT  * FROM  "inv"."inventory_document_header" idh where document_id = 12',
        );
    });

    it('keeps existing WHERE and appends current filter expression with AND', () => {
        const query = 'SELECT * FROM users WHERE is_active = 1';
        const filter = 'name LIKE \'A%\'';

        expect(buildFilterQuery(query, filter)).toBe(
            'SELECT * FROM users where (is_active = 1) AND (name LIKE \'A%\')',
        );
    });

    it('supports dangling WHERE expressions by appending the new condition', () => {
        const query = 'SELECT * FROM users WHERE is_active = 1 AND';
        const filter = 'name LIKE \'A%\'';

        expect(buildFilterQuery(query, filter)).toBe(
            'SELECT * FROM users where is_active = 1 AND name LIKE \'A%\'',
        );
    });

    it('unwraps legacy _zentro_filter query before appending new filter', () => {
        const query = `SELECT * FROM (
SELECT  * FROM  "inv"."inventory_document_header" idh
) AS _zentro_filter where <condition>`;
        const filter = 'document_id = 12';

        expect(buildFilterQuery(query, filter)).toBe(
            'SELECT  * FROM  "inv"."inventory_document_header" idh where document_id = 12',
        );
    });

    it('inserts WHERE before ORDER BY tail', () => {
        const query = 'SELECT * FROM users ORDER BY created_at DESC';
        const filter = 'id > 10';
        expect(buildFilterQuery(query, filter)).toBe(
            'SELECT * FROM users where id > 10 ORDER BY created_at DESC',
        );
    });
});

describe('buildFilterOrderQuery', () => {
    it('builds direct filter + order query without wrappers', () => {
        const query = 'SELECT * FROM accounts a INNER JOIN app.orders o ON a.account_id = o.account_id';
        const result = buildFilterOrderQuery(query, "a.account_id = '1190%'", 'a.created_at DESC');
        expect(result).toBe(
            "SELECT * FROM accounts a INNER JOIN app.orders o ON a.account_id = o.account_id where a.account_id = '1190%' order by a.created_at DESC",
        );
    });

    it('replaces existing top-level ORDER BY', () => {
        const query = 'SELECT * FROM users ORDER BY created_at DESC LIMIT 20';
        const result = buildFilterOrderQuery(query, '', 'id ASC');
        expect(result).toBe('SELECT * FROM users order by id ASC LIMIT 20');
    });

    it('removes existing ORDER BY when order expression is empty', () => {
        const query = 'SELECT * FROM users WHERE is_active = 1 ORDER BY created_at DESC';
        const result = buildFilterOrderQuery(query, 'name LIKE \'A%\'', '');
        expect(result).toBe('SELECT * FROM users where (is_active = 1) AND (name LIKE \'A%\')');
    });
});
