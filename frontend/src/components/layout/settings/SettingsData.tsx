import React from 'react';
import { Database } from 'lucide-react';
import { SettingsClasses } from './SettingsStyles';

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
}

export const SettingsData: React.FC<Props> = ({ 
    limit, onLimitChange, 
    connectTimeout, onConnectTimeoutChange, 
    queryTimeout, onQueryTimeoutChange,
    telemetryOptIn, onTelemetryOptInChange, onExportTelemetry,
}) => {
    return (
        <div className={SettingsClasses.section}>
            <div className={SettingsClasses.sectionInfo}>
                <div className="flex items-center gap-2.5 text-accent mb-1">
                    <Database size={18} strokeWidth={2.5} />
                    <h2 className="text-[17px] font-bold tracking-tight text-text-primary">Data & Query</h2>
                </div>
                <p className="text-[13px] text-text-muted leading-relaxed font-medium">
                    Manage performance thresholds for your datasets.
                </p>
            </div>
            <div className={SettingsClasses.sectionContent}>
                <div className="flex flex-col">
                    <label className={SettingsClasses.label}>Fetch Row Limit</label>
                    <select className={SettingsClasses.input} value={limit} onChange={(e) => onLimitChange(parseInt(e.target.value) || 1000)}>
                        <option value={100}>100 rows</option>
                        <option value={500}>500 rows</option>
                        <option value={1000}>1,000 rows</option>
                        <option value={5000}>5,000 rows</option>
                        <option value={10000}>10,000 rows</option>
                    </select>
                    <span className={SettingsClasses.hint}>Default row count for the result records.</span>
                </div>

                <div className="grid grid-cols-2 gap-6 pt-2">
                    <div className="flex flex-col">
                        <label className={SettingsClasses.label}>Connection Timeout</label>
                        <input
                            className={SettingsClasses.input}
                            type="number"
                            min={5}
                            max={300}
                            value={connectTimeout}
                            onChange={(e) => onConnectTimeoutChange(parseInt(e.target.value) || 10)}
                        />
                        <span className={SettingsClasses.hint}>Seconds before aborting login.</span>
                    </div>

                    <div className="flex flex-col">
                        <label className={SettingsClasses.label}>Execution Timeout</label>
                        <input
                            className={SettingsClasses.input}
                            type="number"
                            min={5}
                            max={100000}
                            value={queryTimeout}
                            onChange={(e) => onQueryTimeoutChange(parseInt(e.target.value) || 60)}
                        />
                        <span className={SettingsClasses.hint}>Seconds for long queries.</span>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-6 pt-2">
                    <div className="flex flex-col">
                        <label className={SettingsClasses.label}>Telemetry (Opt-in)</label>
                        <label className="inline-flex items-center gap-2 text-[13px] text-text-primary">
                            <input
                                type="checkbox"
                                checked={telemetryOptIn}
                                onChange={(e) => onTelemetryOptInChange(e.target.checked)}
                            />
                            Share anonymized product telemetry
                        </label>
                        <span className={SettingsClasses.hint}>Local metrics always stay on device. Opt-in enables product insights export/share.</span>
                    </div>
                    <div className="flex flex-col">
                        <label className={SettingsClasses.label}>Export Telemetry Bundle</label>
                        <button className={SettingsClasses.input} type="button" onClick={onExportTelemetry}>
                            Export JSON Bundle
                        </button>
                        <span className={SettingsClasses.hint}>Exports local query snapshots + telemetry events for diagnostics.</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
