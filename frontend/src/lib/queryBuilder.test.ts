import { describe, expect, it } from 'vitest';
import { buildFilterQuery } from './queryBuilder';

describe('buildFilterQuery', () => {
    it('adds WHERE when current query has no WHERE clause', () => {
        const query = 'SELECT  * FROM  "inv"."inventory_document_header" idh';
        const filter = 'document_id = 12 ';

        expect(buildFilterQuery(query, filter)).toBe(
            'SELECT  * FROM  "inv"."inventory_document_header" idh where document_id = 12',
        );
    });

    it('adds AND when current query already has WHERE clause', () => {
        const query = 'SELECT * FROM users WHERE is_active = 1';
        const filter = 'name LIKE \'A%\'';

        expect(buildFilterQuery(query, filter)).toBe(
            'SELECT * FROM users where is_active = 1 AND (name LIKE \'A%\')',
        );
    });

    it('does not duplicate AND when current WHERE already ends with AND', () => {
        const query = 'SELECT * FROM users WHERE is_active = 1 AND';
        const filter = 'name LIKE \'A%\'';

        expect(buildFilterQuery(query, filter)).toBe(
            'SELECT * FROM users where is_active = 1 AND (name LIKE \'A%\')',
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
});
