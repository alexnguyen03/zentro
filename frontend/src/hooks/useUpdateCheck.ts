import { useState, useEffect } from 'react';
import { CheckForUpdates, GetCurrentVersion } from '../../wailsjs/go/app/App';
import { app } from '../../wailsjs/go/models';
import { useSettingsStore } from '../stores/settingsStore';
import { STORAGE_KEY } from '../lib/constants';

export interface UpdateInfo {
    latest_version: string;
    release_url: string;
    changelog: string;
    has_update: boolean;
}

export const useUpdateCheck = () => {
    const { autoCheckUpdates } = useSettingsStore();
    const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
    const [isChecking, setIsChecking] = useState(false);

    const check = async (manual = false): Promise<UpdateInfo | null | undefined> => {
        if (!manual && !autoCheckUpdates) return null;
        
        setIsChecking(true);
        try {
            const info = await CheckForUpdates();
            const dismissed = localStorage.getItem(STORAGE_KEY.DISMISSED_UPDATE_VERSION);
            const allowDismissFilter = !manual;
            const hasVisibleUpdate = info.has_update && (!allowDismissFilter || info.latest_version !== dismissed);
            const nextInfo = hasVisibleUpdate ? (info as UpdateInfo) : null;
            setUpdateInfo(nextInfo);
            return nextInfo;
        } catch (err) {
            console.error('Failed to check for updates:', err);
            return undefined;
        } finally {
            setIsChecking(false);
        }
    };

    const dismiss = () => {
        if (updateInfo) {
            localStorage.setItem(STORAGE_KEY.DISMISSED_UPDATE_VERSION, updateInfo.latest_version);
            setUpdateInfo(null);
        }
    };

    useEffect(() => {
        // Delay initial check to not interfere with startup
        const timer = setTimeout(() => {
            check();
        }, 5000);
        return () => clearTimeout(timer);
    }, [autoCheckUpdates]);

    return {
        hasUpdate: !!updateInfo,
        updateInfo,
        isChecking,
        check,
        dismiss
    };
};
