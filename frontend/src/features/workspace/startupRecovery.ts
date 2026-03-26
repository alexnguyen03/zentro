import { STORAGE_KEY } from '../../lib/constants';

export interface StartupRecoveryReport {
    recoveredKeys: string[];
    warnings: string[];
}

const TELEMETRY_STORAGE_KEYS = [
    'zentro:telemetry-consent:v1',
    'zentro:telemetry-consent:v2',
    'zentro:query-performance-snapshots:v1',
    'zentro:telemetry-events:v1',
    'zentro:telemetry-analytics-outbox:v1',
];

const QUERY_POLICY_STORAGE_KEYS = [
    'zentro:execution-policy-profiles:v1',
    'zentro:execution-policy-assignments:v1',
];

function removeCorruptedKey(key: string, warning: string, report: StartupRecoveryReport) {
    localStorage.removeItem(key);
    report.recoveredKeys.push(key);
    report.warnings.push(warning);
}

function validateJsonRecord(value: string | null): boolean {
    if (!value) return true;
    const parsed = JSON.parse(value) as unknown;
    return parsed !== null && typeof parsed === 'object';
}

export function recoverStartupState(): StartupRecoveryReport {
    const report: StartupRecoveryReport = {
        recoveredKeys: [],
        warnings: [],
    };

    const criticalKeys = [
        STORAGE_KEY.EDITOR_SESSION,
        STORAGE_KEY.PROJECT_STORE,
        STORAGE_KEY.CONNECTION_STORE,
        STORAGE_KEY.LAYOUT_STORE,
        ...TELEMETRY_STORAGE_KEYS,
        ...QUERY_POLICY_STORAGE_KEYS,
    ];

    for (const key of criticalKeys) {
        try {
            const raw = localStorage.getItem(key);
            if (!validateJsonRecord(raw)) {
                removeCorruptedKey(key, `Recovered corrupted startup state: ${key}`, report);
            }
        } catch {
            removeCorruptedKey(key, `Recovered unreadable startup state: ${key}`, report);
        }
    }

    return report;
}

