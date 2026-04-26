import { beforeEach, describe, expect, it, vi } from 'vitest';

const gatewayMock = vi.hoisted(() => ({
    ExecuteQuery: vi.fn(),
    CancelQuery: vi.fn(),
    ExplainQuery: vi.fn(),
    ExecuteUpdateSync: vi.fn(),
    FetchMoreRows: vi.fn(),
    FormatSQL: vi.fn(),
    CompareQueries: vi.fn(),
    ExportCSV: vi.fn(),
    ExportJSON: vi.fn(),
    ExportSQLInsert: vi.fn(),
    BeginTransaction: vi.fn(),
    CommitTransaction: vi.fn(),
    RollbackTransaction: vi.fn(),
    GetTransactionStatus: vi.fn(),
}));

vi.mock('../platform/app-api/wailsGateway', () => ({
    wailsGateway: gatewayMock,
}));

import {
    CancelQuery,
    ExecuteQuery,
    ExplainQuery,
} from './queryService';

describe('queryService', () => {
    beforeEach(() => {
        Object.values(gatewayMock).forEach((mockFn) => mockFn.mockReset());
    });

    it('calls execute query through gateway', async () => {
        gatewayMock.ExecuteQuery.mockResolvedValue(undefined);

        await ExecuteQuery('tab-1', 'select 1');

        expect(gatewayMock.ExecuteQuery).toHaveBeenCalledWith('tab-1', 'select 1');
    });

    it('calls cancel query through gateway', async () => {
        gatewayMock.CancelQuery.mockResolvedValue(undefined);

        await CancelQuery('tab-1');

        expect(gatewayMock.CancelQuery).toHaveBeenCalledWith('tab-1');
    });

    it('calls explain query through gateway', async () => {
        gatewayMock.ExplainQuery.mockResolvedValue(undefined);

        await ExplainQuery('tab-1', 'select 1', true);

        expect(gatewayMock.ExplainQuery).toHaveBeenCalledWith('tab-1', 'select 1', true);
    });
});
