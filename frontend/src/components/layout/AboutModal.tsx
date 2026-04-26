import React, { useEffect, useMemo, useState } from 'react';
import { Modal } from '../ui';
import appIcon from '../../assets/images/appicon.png';
import { GetAboutInfo } from '../../services/settingsService';
import type { app } from '../../../wailsjs/go/models';
import { Environment } from '../../../wailsjs/runtime/runtime';

interface AboutModalProps {
    onClose: () => void;
}

export const AboutModal: React.FC<AboutModalProps> = ({ onClose }) => {
    const [aboutInfo, setAboutInfo] = useState<app.AboutInfo | null>(null);
    const [runtimeEnv, setRuntimeEnv] = useState<{ buildType: string; platform: string; arch: string } | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            try {
                const [info, env] = await Promise.all([GetAboutInfo(), Environment()]);
                if (cancelled) {
                    return;
                }
                setAboutInfo(info);
                setRuntimeEnv(env);
                setLoadError(null);
            } catch (error) {
                if (cancelled) {
                    return;
                }
                console.error('Failed to load about info', error);
                setLoadError('Unable to load build info');
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        void load();
        return () => {
            cancelled = true;
        };
    }, []);

    const userAgent = globalThis.navigator?.userAgent || '';
    const chromiumMatch = userAgent.match(/(?:Edg|Chrome)\/([\d.]+)/);
    const chromiumVersion = chromiumMatch?.[1] || 'unknown';

    const dateWithRelative = useMemo(() => {
        const raw = aboutInfo?.date?.trim();
        if (!raw || raw === 'unknown') {
            return 'unknown';
        }

        const parsed = new Date(raw);
        if (Number.isNaN(parsed.getTime())) {
            return raw;
        }

        const diffDays = Math.max(0, Math.floor((Date.now() - parsed.getTime()) / (24 * 60 * 60 * 1000)));
        const dayText = diffDays === 1 ? '1 day ago' : `${diffDays} days ago`;
        return `${raw} (${dayText})`;
    }, [aboutInfo?.date]);

    const osValue = useMemo(() => {
        const platform = runtimeEnv?.platform || '';
        const arch = runtimeEnv?.arch || '';
        if (platform && arch) {
            return `${platform} ${arch}`;
        }
        return aboutInfo?.os || 'unknown';
    }, [aboutInfo?.os, runtimeEnv?.arch, runtimeEnv?.platform]);

    const infoRows = useMemo(
        () =>
            [
                { label: 'Version', value: aboutInfo?.version || 'unknown' },
                { label: 'Commit', value: aboutInfo?.commit || 'unknown' },
                { label: 'Date', value: dateWithRelative },
                { label: 'Runtime', value: `Wails (${runtimeEnv?.buildType || 'unknown'})` },
                { label: 'Chromium', value: chromiumVersion },
                { label: 'OS', value: osValue },
            ] as const,
        [aboutInfo?.commit, aboutInfo?.version, chromiumVersion, dateWithRelative, osValue, runtimeEnv?.buildType],
    );

    return (
        <Modal
            isOpen
            onClose={onClose}
            title="About Zentro"
            width={560}
            className="rounded-sm border border-border/20 shadow-elevation-lg"
        >
            <div className="pb-4 pt-2">
                <div className="flex gap-3">
                    <div className="h-42 w-42 overflow-hidden rounded-sm bg-background/60 p-2">
                        <img src={appIcon} alt="Zentro App Icon" className="h-full w-full object-contain" />
                    </div>

                    <div className="min-w-0 flex-1 rounded-sm bg-background/60">
                        {loading && (
                            <div className="px-3 py-2 text-small text-muted-foreground">Loading build information...</div>
                        )}
                        {!loading && loadError && (
                            <div className="px-3 py-2 text-small text-destructive">{loadError}</div>
                        )}
                        {!loading && infoRows.map((row, index) => (
                            <div
                                key={row.label}
                                className="grid grid-cols-[120px_1fr] gap-2 px-3 py-1.5 text-small leading-relaxed even:bg-muted/20"
                            >
                                <span className="font-medium text-foreground">{row.label}:</span>
                                <span
                                    className={index === 1 ? 'break-all text-foreground' : 'text-foreground'}
                                    title={row.value}
                                >
                                    {row.value}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </Modal>
    );
};
