import { STORAGE_KEY } from '../../lib/constants';

export interface StartupRecoveryReport {
    recoveredKeys: string[];
    warnings: string[];
}

const CRITICAL_STORAGE_KEYS = [
    STORAGE_KEY.EDITOR_SESSION,
    STORAGE_KEY.PROJECT_STORE,
    STORAGE_KEY.LAYOUT_STORE,
    STORAGE_KEY.CONNECTION_TREE_UI,
    STORAGE_KEY.TELEMETRY_CONSENT,
    STORAGE_KEY.QUERY_PERFORMANCE_SNAPSHOTS,
    STORAGE_KEY.TELEMETRY_EVENTS,
    STORAGE_KEY.TELEMETRY_ANALYTICS_OUTBOX,
    STORAGE_KEY.EXECUTION_POLICY_PROFILES,
    STORAGE_KEY.EXECUTION_POLICY_ASSIGNMENTS,
];

const LEGACY_STORAGE_KEYS = [
    // connection store
    'zentro:connection-store-v1',
    'zentro:connection-store-v2',
    // editor session
    'zentro:editor-session-v1',
    'zentro:editor-session-v2',
    'zentro:editor-session-v3',
    'zentro:editor-session-v4',
    // project store
    'zentro:project-store-v1',
    'zentro:project-store-v2',
    // layout store
    'zentro:layout-store-v1',
    'zentro:layout-store-v2',
    // sidebar ui
    'zentro:sidebar-ui-v1',
    // connection tree ui
    'zentro:connection-tree-ui-v1',
    // dismissed update version
    'zentro:dismissed-update-version-v1',
    'zentro:dismissed-update-version-v2',
    // telemetry consent
    'zentro:telemetry-consent:v1',
    'zentro:telemetry-consent:v2',
    // query performance snapshots
    'zentro:query-performance-snapshots:v1',
    // telemetry events
    'zentro:telemetry-events:v1',
    // telemetry analytics outbox
    'zentro:telemetry-analytics-outbox:v1',
    // execution policy
    'zentro:execution-policy-profiles:v1',
    'zentro:execution-policy-assignments:v1',
    'zentro:execution-policy-strong-confirm-from:v1',
];

function removeCorruptedKey(key: string, warning: string, report: StartupRecoveryReport) {
    localStorage.removeItem(key);
    report.recoveredKeys.push(key);
    report.warnings.push(warning);
}

function removeLegacyKey(key: string, report: StartupRecoveryReport) {
    if (localStorage.getItem(key) === null) return;
    localStorage.removeItem(key);
    report.recoveredKeys.push(key);
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

    for (const key of CRITICAL_STORAGE_KEYS) {
        try {
            const raw = localStorage.getItem(key);
            if (!validateJsonRecord(raw)) {
                removeCorruptedKey(key, `Recovered corrupted startup state: ${key}`, report);
            }
        } catch {
            removeCorruptedKey(key, `Recovered unreadable startup state: ${key}`, report);
        }
    }

    for (const key of LEGACY_STORAGE_KEYS) {
        removeLegacyKey(key, report);
    }

    return report;
}
