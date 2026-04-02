import { describe, expect, it } from 'vitest';
import { evaluateWhenExpression } from './whenExpression';

describe('evaluateWhenExpression', () => {
    it('evaluates precedence with !, &&, || and parentheses', () => {
        const context = {
            sqlEditorFocus: true,
            queryTabActive: true,
            viewMode: false,
            modalOpen: false,
        };

        expect(evaluateWhenExpression('sqlEditorFocus && queryTabActive && !viewMode', context)).toBe(true);
        expect(evaluateWhenExpression('viewMode || modalOpen', context)).toBe(false);
        expect(evaluateWhenExpression('sqlEditorFocus && (queryTabActive || modalOpen)', context)).toBe(true);
        expect(evaluateWhenExpression('!(sqlEditorFocus && queryTabActive)', context)).toBe(false);
    });

    it('returns true for empty expression and false for invalid syntax', () => {
        expect(evaluateWhenExpression('', { any: true })).toBe(true);
        expect(evaluateWhenExpression('sqlEditorFocus &&&', { sqlEditorFocus: true })).toBe(false);
    });
});
