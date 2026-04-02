import React from 'react';
import { ConfirmationModal } from '../../components/ui/ConfirmationModal';
import { getEnvironmentMeta } from '../../lib/projects';
import { resolveQueryPolicy } from './policy';
import {
    type OperationRiskAnalysis,
    type SqlRiskAnalysis,
    type WriteOperationKind,
    type WriteSafetyDecision,
    analyzeOperationRisk,
    analyzeSqlRisk,
    evaluateWriteSafetyDecision,
} from './writeSafety';

export interface WriteSafetyGuardResult {
    allowed: boolean;
    blockedReason?: string;
}

type PendingRequest = {
    decision: WriteSafetyDecision;
    resolve: (result: WriteSafetyGuardResult) => void;
};

function createFinalConfirmDescription(environmentKey?: string | null): string {
    const envMeta = getEnvironmentMeta(environmentKey);
    return `You are about to run a destructive write on ${envMeta.label}. This is the final confirmation.`;
}

export function useWriteSafetyGuard(environmentKey?: string | null) {
    const [primaryRequest, setPrimaryRequest] = React.useState<PendingRequest | null>(null);
    const [secondaryRequest, setSecondaryRequest] = React.useState<PendingRequest | null>(null);

    const closeWithResult = React.useCallback((request: PendingRequest | null, result: WriteSafetyGuardResult) => {
        if (!request) return;
        request.resolve(result);
    }, []);

    const requestConfirmation = React.useCallback((decision: WriteSafetyDecision): Promise<WriteSafetyGuardResult> => {
        return new Promise((resolve) => {
            setPrimaryRequest({
                decision,
                resolve,
            });
        });
    }, []);

    const guardFromAnalysis = React.useCallback(async (
        analysis: SqlRiskAnalysis | OperationRiskAnalysis,
        actionLabel: string,
    ): Promise<WriteSafetyGuardResult> => {
        const policy = resolveQueryPolicy(environmentKey || undefined);
        const decision = evaluateWriteSafetyDecision({
            analysis,
            actionLabel,
            environmentKey,
            safetyLevel: policy.safetyLevel,
            strongConfirmFromEnvironment: policy.strongConfirmFromEnvironment,
        });

        if (decision.action === 'allow') {
            return { allowed: true };
        }

        if (decision.action === 'block') {
            return {
                allowed: false,
                blockedReason: decision.message,
            };
        }

        return requestConfirmation(decision);
    }, [environmentKey, requestConfirmation]);

    const guardSql = React.useCallback(async (sql: string, actionLabel: string): Promise<WriteSafetyGuardResult> => {
        return guardFromAnalysis(analyzeSqlRisk(sql), actionLabel);
    }, [guardFromAnalysis]);

    const guardOperations = React.useCallback(async (
        operations: WriteOperationKind[],
        actionLabel: string,
    ): Promise<WriteSafetyGuardResult> => {
        return guardFromAnalysis(analyzeOperationRisk(operations), actionLabel);
    }, [guardFromAnalysis]);

    const handlePrimaryClose = React.useCallback(() => {
        if (!primaryRequest) return;
        closeWithResult(primaryRequest, {
            allowed: false,
            blockedReason: 'Action cancelled by user.',
        });
        setPrimaryRequest(null);
    }, [closeWithResult, primaryRequest]);

    const handlePrimaryConfirm = React.useCallback(() => {
        if (!primaryRequest) return;
        if (primaryRequest.decision.requiresDoubleConfirm) {
            setSecondaryRequest(primaryRequest);
            setPrimaryRequest(null);
            return;
        }

        closeWithResult(primaryRequest, { allowed: true });
        setPrimaryRequest(null);
    }, [closeWithResult, primaryRequest]);

    const handleSecondaryClose = React.useCallback(() => {
        if (!secondaryRequest) return;
        closeWithResult(secondaryRequest, {
            allowed: false,
            blockedReason: 'Final confirmation was not completed.',
        });
        setSecondaryRequest(null);
    }, [closeWithResult, secondaryRequest]);

    const handleSecondaryConfirm = React.useCallback(() => {
        if (!secondaryRequest) return;
        closeWithResult(secondaryRequest, { allowed: true });
        setSecondaryRequest(null);
    }, [closeWithResult, secondaryRequest]);

    const modals = (
        <>
            <ConfirmationModal
                isOpen={Boolean(primaryRequest)}
                onClose={handlePrimaryClose}
                onConfirm={handlePrimaryConfirm}
                title={primaryRequest?.decision.title || 'Confirm Write Operation'}
                message={primaryRequest?.decision.message || ''}
                description={primaryRequest?.decision.description}
                confirmLabel={primaryRequest?.decision.confirmLabel || 'Continue'}
                variant={primaryRequest?.decision.severity === 'danger' ? 'danger' : 'primary'}
                closeOnConfirm={!primaryRequest?.decision.requiresDoubleConfirm}
            />
            <ConfirmationModal
                isOpen={Boolean(secondaryRequest)}
                onClose={handleSecondaryClose}
                onConfirm={handleSecondaryConfirm}
                title="Final Destructive Confirmation"
                message="This environment requires one more confirmation for destructive writes."
                description={createFinalConfirmDescription(environmentKey)}
                confirmLabel="Run Anyway"
                variant="danger"
            />
        </>
    );

    return {
        guardSql,
        guardOperations,
        modals,
    };
}
