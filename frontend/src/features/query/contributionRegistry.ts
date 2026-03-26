import type {
    QueryCommandContribution,
    ResultActionContribution,
} from './contracts';

const queryCommandContributions = new Map<string, QueryCommandContribution>();
const resultActionContributions = new Map<string, ResultActionContribution>();

export function registerQueryCommandContribution(contribution: QueryCommandContribution): () => void {
    queryCommandContributions.set(contribution.id, contribution);
    return () => {
        queryCommandContributions.delete(contribution.id);
    };
}

export function listQueryCommandContributions(): QueryCommandContribution[] {
    return Array.from(queryCommandContributions.values());
}

export function registerResultActionContribution(contribution: ResultActionContribution): () => void {
    resultActionContributions.set(contribution.id, contribution);
    return () => {
        resultActionContributions.delete(contribution.id);
    };
}

export function listResultActionContributions(): ResultActionContribution[] {
    return Array.from(resultActionContributions.values());
}

