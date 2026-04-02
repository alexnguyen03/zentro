import { describe, expect, it } from 'vitest';
import {
    analyzeOperationRisk,
    analyzeSqlRisk,
    evaluateWriteSafetyDecision,
} from './writeSafety';

describe('writeSafety analyzer', () => {
    it('splits statements and ignores comments/strings', () => {
        const analysis = analyzeSqlRisk(`
            -- UPDATE users SET name = 'x'
            UPDATE users SET note = 'where token';
            SELECT 1;
        `);
        expect(analysis.hasWrite).toBe(true);
        expect(analysis.hasUpdateNoWhere).toBe(true);
        expect(analysis.operations).toContain('update');
    });

    it('detects destructive operations and no-where delete', () => {
        const analysis = analyzeSqlRisk('DELETE FROM users; ALTER TABLE users ADD COLUMN bio TEXT;');
        expect(analysis.hasDeleteNoWhere).toBe(true);
        expect(analysis.hasDestructive).toBe(true);
        expect(analysis.operations).toContain('delete');
        expect(analysis.operations).toContain('alter');
    });
});

describe('writeSafety decision', () => {
    it('blocks no-where update in strict mode', () => {
        const decision = evaluateWriteSafetyDecision({
            analysis: analyzeSqlRisk('UPDATE users SET name = \'admin\';'),
            safetyLevel: 'strict',
            environmentKey: 'dev',
            actionLabel: 'Run Query',
        });
        expect(decision.action).toBe('block');
    });

    it('requires confirmation in balanced mode for no-where update', () => {
        const decision = evaluateWriteSafetyDecision({
            analysis: analyzeSqlRisk('UPDATE users SET name = \'admin\';'),
            safetyLevel: 'balanced',
            environmentKey: 'dev',
            actionLabel: 'Run Query',
        });
        expect(decision.action).toBe('confirm');
        expect(decision.requiresDoubleConfirm).toBe(false);
    });

    it('requires double confirmation on production destructive operations', () => {
        const decision = evaluateWriteSafetyDecision({
            analysis: analyzeOperationRisk(['drop']),
            safetyLevel: 'strict',
            environmentKey: 'pro',
            actionLabel: 'Drop Table',
        });
        expect(decision.action).toBe('confirm');
        expect(decision.requiresDoubleConfirm).toBe(true);
    });

    it('requires single confirmation for non-threshold destructive operations', () => {
        const decision = evaluateWriteSafetyDecision({
            analysis: analyzeOperationRisk(['drop']),
            safetyLevel: 'relaxed',
            environmentKey: 'loc',
            actionLabel: 'Drop Table',
        });
        expect(decision.action).toBe('confirm');
        expect(decision.requiresDoubleConfirm).toBe(false);
    });

    it('still requires double confirmation for production destructive operations in relaxed mode', () => {
        const decision = evaluateWriteSafetyDecision({
            analysis: analyzeOperationRisk(['drop']),
            safetyLevel: 'relaxed',
            environmentKey: 'pro',
            actionLabel: 'Drop Table',
        });
        expect(decision.action).toBe('confirm');
        expect(decision.requiresDoubleConfirm).toBe(true);
    });

    it('applies strong confirmation threshold from staging and above', () => {
        const devDecision = evaluateWriteSafetyDecision({
            analysis: analyzeOperationRisk(['drop']),
            safetyLevel: 'balanced',
            environmentKey: 'dev',
            strongConfirmFromEnvironment: 'sta',
            actionLabel: 'Drop Table',
        });
        expect(devDecision.action).toBe('confirm');
        expect(devDecision.requiresDoubleConfirm).toBe(false);

        const stagingDecision = evaluateWriteSafetyDecision({
            analysis: analyzeOperationRisk(['drop']),
            safetyLevel: 'balanced',
            environmentKey: 'sta',
            strongConfirmFromEnvironment: 'sta',
            actionLabel: 'Drop Table',
        });
        expect(stagingDecision.action).toBe('confirm');
        expect(stagingDecision.requiresDoubleConfirm).toBe(true);
    });
});
