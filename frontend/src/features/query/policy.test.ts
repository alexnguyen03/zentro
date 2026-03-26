import { describe, expect, it } from 'vitest';
import { isMutatingSql } from './policy';

describe('query policy', () => {
    it('detects mutating statements', () => {
        expect(isMutatingSql('UPDATE users SET a = 1')).toBe(true);
        expect(isMutatingSql('delete from users')).toBe(true);
    });

    it('keeps select as non-mutating', () => {
        expect(isMutatingSql('SELECT * FROM users')).toBe(false);
    });
});

