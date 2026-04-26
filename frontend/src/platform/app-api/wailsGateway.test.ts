import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CONNECTION_STATUS } from '../../lib/constants';

const { getConnectionStatusMock } = vi.hoisted(() => ({
    getConnectionStatusMock: vi.fn(),
}));

vi.mock('../../../wailsjs/go/app/App', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../wailsjs/go/app/App')>();
    return {
        ...actual,
        GetConnectionStatus: getConnectionStatusMock,
    };
});

import { wailsGateway } from './wailsGateway';

describe('wailsGateway', () => {
    beforeEach(() => {
        getConnectionStatusMock.mockReset();
    });

    it('normalizes raw connection status payload', async () => {
        getConnectionStatusMock.mockResolvedValue({
            status: CONNECTION_STATUS.CONNECTED,
            profile: {
                name: 'local-dev',
                driver: 'postgres',
                host: 'localhost',
                port: 5432,
                db_name: 'main',
                username: 'admin',
                password: '',
                ssl_mode: 'disable',
                connect_timeout: 10,
                save_password: true,
                encrypt_password: true,
                show_all_schemas: true,
                trust_server_cert: false,
            },
        });

        const status = await wailsGateway.GetConnectionStatus();

        expect(status.status).toBe(CONNECTION_STATUS.CONNECTED);
        expect(status.profile?.name).toBe('local-dev');
        expect(status.profile?.driver).toBe('postgres');
    });

    it('falls back to disconnected when payload is invalid', async () => {
        getConnectionStatusMock.mockResolvedValue({ status: 'random-value' });

        const status = await wailsGateway.GetConnectionStatus();

        expect(status.status).toBe(CONNECTION_STATUS.DISCONNECTED);
        expect(status.profile).toBeNull();
    });
});
