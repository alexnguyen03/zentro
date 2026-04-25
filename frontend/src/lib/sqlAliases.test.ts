import { describe, expect, it } from 'vitest';
import { extractSelectAliases, extractTableAliases } from './sqlAliases';

describe('sqlAliases', () => {
    it('extracts aliases declared with AS', () => {
        const aliases = extractSelectAliases('select u.email as email_alias, u.id as user_id from users u');
        expect(aliases).toEqual(['email_alias', 'user_id']);
    });

    it('extracts quoted aliases', () => {
        const aliases = extractSelectAliases('select u.full_name as "Full Name", u.id from users u');
        expect(aliases).toEqual(['Full Name']);
    });

    it('ignores non-aliased select expressions', () => {
        const aliases = extractSelectAliases('select id, email, created_at from users');
        expect(aliases).toEqual([]);
    });

    it('extracts table aliases from JOIN clauses', () => {
        const aliases = extractTableAliases('select * from accounts a inner join app.orders o on a.account_id = o.account_id');
        expect(aliases).toEqual(['a', 'o']);
    });

    it('falls back to table name when alias is absent', () => {
        const aliases = extractTableAliases('select * from app.orders');
        expect(aliases).toEqual(['orders']);
    });
});
