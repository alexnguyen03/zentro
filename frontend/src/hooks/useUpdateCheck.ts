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

    const check = async (manual = false) => {
        if (!manual && !autoCheckUpdates) return;
        
        setIsChecking(true);
        try {
            const info = await CheckForUpdates();
            // Check if this version was already dismissed
            const dismissed = localStorage.getItem(STORAGE_KEY.DISMISSED_UPDATE_VERSION);
            if (info.has_update && info.latest_version !== dismissed) {
                setUpdateInfo(info as UpdateInfo);
            } else {
                setUpdateInfo(null);
            }
        } catch (err) {
            console.error('Failed to check for updates:', err);
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
