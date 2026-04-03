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
    activeSafetyEnvironment: EnvironmentKey;
    safetyLevel: SafetyLevel;
    onSafetyLevelChange: (val: SafetyLevel) => void;
    strongConfirmFromEnvironment: EnvironmentKey;
    onStrongConfirmFromEnvironmentChange: (val: EnvironmentKey) => void;
}

const STRONG_CONFIRM_SLIDER_KEYS = [...ENVIRONMENT_KEYS].reverse() as EnvironmentKey[];

const STRONG_CONFIRM_INDEX = STRONG_CONFIRM_SLIDER_KEYS.reduce<Record<EnvironmentKey, number>>((acc, key, index) => {
    acc[key] = index;
    return acc;
}, {} as Record<EnvironmentKey, number>);

export const SettingsData: React.FC<Props> = ({ 
    limit, onLimitChange, 
    connectTimeout, onConnectTimeoutChange, 
    queryTimeout, onQueryTimeoutChange,
    telemetryOptIn, onTelemetryOptInChange, onExportTelemetry,
    activeSafetyEnvironment,
    safetyLevel, onSafetyLevelChange,
    strongConfirmFromEnvironment, onStrongConfirmFromEnvironmentChange,
}) => {
    const maxSliderIndex = STRONG_CONFIRM_SLIDER_KEYS.length - 1;
    const strongConfirmIndex = STRONG_CONFIRM_INDEX[strongConfirmFromEnvironment] ?? 0;
    const activeSafetyEnvironmentLabel = getEnvironmentMeta(activeSafetyEnvironment).label;
    const strongConfirmLabel = getEnvironmentMeta(strongConfirmFromEnvironment).label;
    const setStrongConfirmByIndex = (index: number) => {
        const nextEnvironment = STRONG_CONFIRM_SLIDER_KEYS[index];
        if (nextEnvironment) {
            onStrongConfirmFromEnvironmentChange(nextEnvironment);
        }
    };

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
                    <SelectField value={limit} onValueChange={(value) => onLimitChange(parseInt(value, 10) || 1000)}>
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
                    label="Write Safety Level"
                    hint={`Applies to current environment: ${activeSafetyEnvironmentLabel}. Strict blocks UPDATE/DELETE without WHERE.`}
                >
                    <SelectField
                        value={safetyLevel}
                        onValueChange={(value) => onSafetyLevelChange(value as SafetyLevel)}
                    >
                        <option value="strict">Strict</option>
                        <option value="balanced">Balanced</option>
                        <option value="relaxed">Relaxed</option>
                    </SelectField>
                </FormField>

                <FormField
                    label="Strong Confirm From Environment"
                    hint={`Current threshold: ${strongConfirmLabel}. Environments at or above this level require double-confirm for destructive writes.`}
                >
                    <div className="rounded-md border border-border/25 bg-bg-primary/60 px-3 py-3">
                        <input
                            type="range"
                            min={0}
                            max={maxSliderIndex}
                            step={1}
                            value={strongConfirmIndex}
                            onChange={(event) => {
                                const nextIndex = parseInt(event.target.value, 10);
                                setStrongConfirmByIndex(nextIndex);
                            }}
                            className="w-full cursor-pointer accent-accent"
                            aria-label="Strong Confirm From Environment"
                        />
                        <div className="relative mt-1 h-2">
                            {STRONG_CONFIRM_SLIDER_KEYS.map((key, index) => {
                                const isActive = key === strongConfirmFromEnvironment;
                                const position = `${(index / maxSliderIndex) * 100}%`;
                                const alignmentClass = index === 0
                                    ? 'left-0 translate-x-0'
                                    : index === maxSliderIndex
                                        ? 'left-full -translate-x-full'
                                        : '-translate-x-1/2';
                                return (
                                    <span
                                        key={key}
                                        className={`absolute top-0 h-2 w-2 rounded-full border ${alignmentClass} ${isActive ? 'border-accent bg-accent' : 'border-border/60 bg-bg-primary'}`}
                                        style={{ left: position }}
                                    />
                                );
                            })}
                        </div>
                        <div className="relative mt-2 h-7">
                            {STRONG_CONFIRM_SLIDER_KEYS.map((key, index) => {
                                const isActive = key === strongConfirmFromEnvironment;
                                const position = `${(index / maxSliderIndex) * 100}%`;
                                const alignmentClass = index === 0
                                    ? 'left-0 translate-x-0'
                                    : index === maxSliderIndex
                                        ? 'left-full -translate-x-full'
                                        : '-translate-x-1/2';

                                return (
                                    <button
                                        key={key}
                                        type="button"
                                        onClick={() => setStrongConfirmByIndex(index)}
                                        className={`absolute top-0 text-[11px] transition-colors hover:text-accent ${alignmentClass} ${isActive ? 'font-semibold text-accent' : 'text-text-muted/75'}`}
                                        style={{ left: position }}
                                        aria-label={`Set strong confirm threshold to ${getEnvironmentMeta(key).label}`}
                                        title={`Set to ${getEnvironmentMeta(key).label}`}
                                    >
                                        {getEnvironmentMeta(key).label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
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
                    <Button type="button" variant="secondary" size="sm" className="w-fit" onClick={onExportTelemetry}>
                        Export Pipeline Bundle
                    </Button>
                </FormField>
            </div>
        </div>
    );
};
