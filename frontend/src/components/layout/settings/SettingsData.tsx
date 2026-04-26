import React from 'react';
import { Database } from 'lucide-react';
import { SettingsClasses } from './SettingsStyles';
import {
    Input,
    Label,
    Select,
    SelectContent,
    SelectItem,
    SelectSeparator,
    SelectTrigger,
    SelectValue,
    Slider,
} from '../../ui';
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
    activeSafetyEnvironment: EnvironmentKey;
    safetyLevel: SafetyLevel;
    onSafetyLevelChange: (val: SafetyLevel) => void;
    strongConfirmFromEnvironment: EnvironmentKey;
    onStrongConfirmFromEnvironmentChange: (val: EnvironmentKey) => void;
}

const STRONG_CONFIRM_SLIDER_KEYS = [...ENVIRONMENT_KEYS].reverse() as EnvironmentKey[];
const SAFETY_LEVEL_EXPLANATIONS: Record<SafetyLevel, { title: string; description: string }> = {
    strict: {
        title: 'Strict',
        description: 'Blocks UPDATE/DELETE without WHERE. Other writes still require confirmation.',
    },
    balanced: {
        title: 'Balanced',
        description: 'Prompts for write operations. Destructive writes always require explicit confirmation.',
    },
    relaxed: {
        title: 'Relaxed',
        description: 'Allows non-destructive writes (e.g. INSERT/CREATE) without prompt. Destructive writes still prompt.',
    },
};

const STRONG_CONFIRM_INDEX = STRONG_CONFIRM_SLIDER_KEYS.reduce<Record<EnvironmentKey, number>>((acc, key, index) => {
    acc[key] = index;
    return acc;
}, {} as Record<EnvironmentKey, number>);

export const SettingsData: React.FC<Props> = ({ 
    limit, onLimitChange, 
    connectTimeout, onConnectTimeoutChange, 
    queryTimeout, onQueryTimeoutChange,
    activeSafetyEnvironment,
    safetyLevel, onSafetyLevelChange,
    strongConfirmFromEnvironment, onStrongConfirmFromEnvironmentChange,
}) => {
    const [hoveredSafetyLevel, setHoveredSafetyLevel] = React.useState<SafetyLevel>(safetyLevel);
    const maxSliderIndex = STRONG_CONFIRM_SLIDER_KEYS.length - 1;
    const strongConfirmIndex = STRONG_CONFIRM_INDEX[strongConfirmFromEnvironment] ?? 0;
    const activeSafetyEnvironmentLabel = getEnvironmentMeta(activeSafetyEnvironment).label;
    const strongConfirmLabel = getEnvironmentMeta(strongConfirmFromEnvironment).label;
    const hoveredSafetyInfo = SAFETY_LEVEL_EXPLANATIONS[hoveredSafetyLevel];
    const sliderValue = [strongConfirmIndex];

    React.useEffect(() => {
        setHoveredSafetyLevel(safetyLevel);
    }, [safetyLevel]);

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
                <div className="space-y-1.5">
                    <Label>Fetch Row Limit</Label>
                    <Select value={String(limit)} onValueChange={(value) => onLimitChange(parseInt(value, 10) || 1000)}>
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="100">100 rows</SelectItem>
                            <SelectItem value="500">500 rows</SelectItem>
                            <SelectItem value="1000">1,000 rows</SelectItem>
                            <SelectItem value="5000">5,000 rows</SelectItem>
                            <SelectItem value="10000">10,000 rows</SelectItem>
                        </SelectContent>
                    </Select>
                    <p className="text-label text-muted-foreground">Default row count for the result records.</p>
                </div>

                <div className="space-y-1.5">
                    <Label>Connection Timeout</Label>
                    <Input
                        type="number"
                        min={5}
                        max={300}
                        value={connectTimeout}
                        onChange={(e) => onConnectTimeoutChange(parseInt(e.target.value) || 10)}
                    />
                    <p className="text-label text-muted-foreground">Seconds before aborting login.</p>
                </div>

                <div className="space-y-1.5">
                    <Label>Execution Timeout</Label>
                    <Input
                        type="number"
                        min={5}
                        max={100000}
                        value={queryTimeout}
                        onChange={(e) => onQueryTimeoutChange(parseInt(e.target.value) || 60)}
                    />
                    <p className="text-label text-muted-foreground">Seconds for long queries.</p>
                </div>

                <div className="space-y-1.5">
                    <Label>Write Safety Level</Label>
                    <Select
                        value={safetyLevel}
                        onValueChange={(value) => onSafetyLevelChange(value as SafetyLevel)}
                        onOpenChange={(open) => {
                            if (open) {
                                setHoveredSafetyLevel(safetyLevel);
                            }
                        }}
                    >
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="p-0">
                            <SelectItem
                                value="strict"
                                onPointerMove={() => setHoveredSafetyLevel('strict')}
                                onFocus={() => setHoveredSafetyLevel('strict')}
                            >
                                Strict
                            </SelectItem>
                            <SelectItem
                                value="balanced"
                                onPointerMove={() => setHoveredSafetyLevel('balanced')}
                                onFocus={() => setHoveredSafetyLevel('balanced')}
                            >
                                Balanced
                            </SelectItem>
                            <SelectItem
                                value="relaxed"
                                onPointerMove={() => setHoveredSafetyLevel('relaxed')}
                                onFocus={() => setHoveredSafetyLevel('relaxed')}
                            >
                                Relaxed
                            </SelectItem>
                            <SelectSeparator className="mx-0 my-0" />
                            <div className="px-3 py-2 text-label text-muted-foreground">
                                {hoveredSafetyInfo.description}
                            </div>
                        </SelectContent>
                    </Select>
                    <p className="text-label text-muted-foreground">
                        {`Applies to current environment: ${activeSafetyEnvironmentLabel}. Strict blocks UPDATE/DELETE without WHERE.`}
                    </p>
                </div>

                <div className="space-y-1.5">
                    <Label>Strong Confirm From Environment</Label>
                    <div className="rounded-sm bg-muted/35 px-3 py-3">
                        <Slider
                            min={0}
                            max={maxSliderIndex}
                            step={1}
                            value={sliderValue}
                            onValueChange={(values) => {
                                const nextIndex = values[0];
                                if (typeof nextIndex === 'number') {
                                    setStrongConfirmByIndex(Math.round(nextIndex));
                                }
                            }}
                            className="w-full cursor-pointer"
                            aria-label="Strong Confirm From Environment"
                            aria-valuetext={strongConfirmLabel}
                        />
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
                                    <div
                                        key={key}
                                        onClick={() => setStrongConfirmByIndex(index)}
                                        className={` cursor-pointer absolute top-2 h-auto px-1 py-0 text-label transition-colors hover:text-accent ${alignmentClass} ${isActive ? 'font-semibold text-accent' : 'text-muted-foreground'}`}
                                        style={{ left: position }}
                                        aria-label={`Set strong confirm threshold to ${getEnvironmentMeta(key).label}`}
                                        title={`Set to ${getEnvironmentMeta(key).label}`}
                                    >
                                        {getEnvironmentMeta(key).label}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                    <p className="text-label text-muted-foreground">
                        {`Current threshold: ${strongConfirmLabel}. Environments at or above this level require double-confirm for destructive writes.`}
                    </p>
                </div>

            </div>
        </div>
    );
};
