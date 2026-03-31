import React from 'react';
import { Database } from 'lucide-react';
import { SettingsClasses } from './SettingsStyles';
import { Button, FormField, Input, SelectField, SwitchField } from '../../ui';
import { ENVIRONMENT_KEYS, getEnvironmentMeta } from '../../../lib/projects';
import type { EnvironmentKey } from '../../../types/project';
import type { SafetyLevel } from '../../../features/query/policyProfiles';

interface Props {
    limit: number;
    onLimitChange: (val: number) => void;
    connectTimeout: number;
    onConnectTimeoutChange: (val: number) => void;
    queryTimeout: number;
    onQueryTimeoutChange: (val: number) => void;
    telemetryOptIn: boolean;
    onTelemetryOptInChange: (val: boolean) => void;
    onExportTelemetry: () => void;
    safetyEnvironment: EnvironmentKey;
    onSafetyEnvironmentChange: (val: EnvironmentKey) => void;
    safetyLevel: SafetyLevel;
    onSafetyLevelChange: (val: SafetyLevel) => void;
}

export const SettingsData: React.FC<Props> = ({ 
    limit, onLimitChange, 
    connectTimeout, onConnectTimeoutChange, 
    queryTimeout, onQueryTimeoutChange,
    telemetryOptIn, onTelemetryOptInChange, onExportTelemetry,
    safetyEnvironment, onSafetyEnvironmentChange,
    safetyLevel, onSafetyLevelChange,
}) => {
    return (
        <div className={SettingsClasses.section}>
            <div className={SettingsClasses.sectionInfo}>
                <div className="flex items-center gap-2.5 text-accent mb-1">
                    <Database size={18} strokeWidth={2.5} />
                    <h2 className={SettingsClasses.sectionTitle}>Data & Query</h2>
                </div>
                <p className={SettingsClasses.sectionDescription}>
                    Manage performance thresholds for your datasets.
                </p>
            </div>
            <div className={SettingsClasses.sectionContent}>
                <FormField label="Fetch Row Limit" hint="Default row count for the result records.">
                    <SelectField value={limit} onChange={(e) => onLimitChange(parseInt(e.target.value) || 1000)}>
                        <option value={100}>100 rows</option>
                        <option value={500}>500 rows</option>
                        <option value={1000}>1,000 rows</option>
                        <option value={5000}>5,000 rows</option>
                        <option value={10000}>10,000 rows</option>
                    </SelectField>
                </FormField>

                <FormField label="Connection Timeout" hint="Seconds before aborting login.">
                    <Input
                        type="number"
                        min={5}
                        max={300}
                        value={connectTimeout}
                        onChange={(e) => onConnectTimeoutChange(parseInt(e.target.value) || 10)}
                    />
                </FormField>

                <FormField label="Execution Timeout" hint="Seconds for long queries.">
                    <Input
                        type="number"
                        min={5}
                        max={100000}
                        value={queryTimeout}
                        onChange={(e) => onQueryTimeoutChange(parseInt(e.target.value) || 60)}
                    />
                </FormField>

                <FormField
                    label="Write Safety Environment"
                    hint="Choose which environment policy level you want to configure."
                >
                    <SelectField
                        value={safetyEnvironment}
                        onChange={(event) => onSafetyEnvironmentChange(event.target.value as EnvironmentKey)}
                    >
                        {ENVIRONMENT_KEYS.map((key) => (
                            <option key={key} value={key}>
                                {key.toUpperCase()} - {getEnvironmentMeta(key).label}
                            </option>
                        ))}
                    </SelectField>
                </FormField>

                <FormField
                    label="Write Safety Level"
                    hint="Strict blocks UPDATE/DELETE without WHERE. Balanced warns. Relaxed keeps lightweight warnings."
                >
                    <SelectField
                        value={safetyLevel}
                        onChange={(event) => onSafetyLevelChange(event.target.value as SafetyLevel)}
                    >
                        <option value="strict">Strict</option>
                        <option value="balanced">Balanced</option>
                        <option value="relaxed">Relaxed</option>
                    </SelectField>
                </FormField>

                <FormField
                    label="Telemetry (Opt-in)"
                    hint="Local metrics always stay on device. Opt-in enables product insights export/share."
                >
                    <div className="flex items-center justify-between rounded-md border border-border/25 bg-bg-primary/60 px-3 py-2">
                        <span className="text-[12px] text-text-primary">Share anonymized product telemetry</span>
                        <SwitchField
                            checked={telemetryOptIn}
                            onChange={onTelemetryOptInChange}
                            aria-label="Share anonymized product telemetry"
                        />
                    </div>
                </FormField>

                <FormField
                    label="Export Telemetry Bundle"
                    hint="Exports local metrics + anonymized analytics outbox (if opted-in)."
                >
                    <Button type="button" variant="solid" size="sm" className="w-fit" onClick={onExportTelemetry}>
                        Export Pipeline Bundle
                    </Button>
                </FormField>
            </div>
        </div>
    );
};
