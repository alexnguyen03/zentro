import { useState, useEffect } from 'react';
import { models } from '../../wailsjs/go/models';
import { TestConnection, SaveConnection } from '../services/connectionService';
import {
    getProvider,
    makeDefaultForm,
    parseConnectionString,
    validateConnectionForm,
} from '../lib/providers';
import type { ConnectionProfile } from '../types/connection';

export type TestResult = 'idle' | 'ok' | 'error';

export interface UseConnectionFormOptions {
    profile?: ConnectionProfile | null;
    isOpen?: boolean;
    existingNames?: string[];
    onSaved?: () => void;
    onClose?: () => void;
}

export interface UseConnectionFormReturn {
    formData: Partial<ConnectionProfile>;
    connString: string;
    testing: boolean;
    saving: boolean;
    testResult: TestResult;
    errorMsg: string;
    successMsg: string;
    isEditing: boolean;
    selectedProvider: string;
    handleDriverChange: (key: string) => void;
    handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
    handleParseConnectionString: (e: React.ChangeEvent<HTMLInputElement>) => void;
    handleTest: () => Promise<void>;
    handleSave: (e: React.FormEvent) => Promise<void>;
    resetFeedback: () => void;
    resetForm: () => void;
}

export function useConnectionForm({
    profile,
    isOpen = true,
    existingNames = [],
    onSaved,
    onClose,
}: UseConnectionFormOptions): UseConnectionFormReturn {
    const [formData, setFormData] = useState<Partial<ConnectionProfile>>(makeDefaultForm());
    const [connString, setConnString] = useState('');
    const [testing, setTesting] = useState(false);
    const [saving, setSaving] = useState(false);
    const [testResult, setTestResult] = useState<TestResult>('idle');
    const [errorMsg, setErrorMsg] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    const isEditing = Boolean(profile);

    useEffect(() => {
        if (!isOpen) return;
        setFormData(profile ? { ...profile } : makeDefaultForm());
        setConnString('');
        setErrorMsg('');
        setSuccessMsg('');
        setTestResult('idle');
    }, [isOpen, profile]);

    const resetFeedback = () => {
        setTestResult('idle');
        setSuccessMsg('');
        setErrorMsg('');
    };

    const resetForm = () => {
        setFormData(makeDefaultForm());
        setConnString('');
        resetFeedback();
    };

    const handleDriverChange = (key: string) => {
        if (isEditing) return;
        const p = getProvider(key);
        setFormData(prev => ({
            ...prev,
            driver: key,
            port: p.defaultPort ?? prev.port,
            ssl_mode: p.defaultSsl,
        }));
        resetFeedback();
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        if (type === 'checkbox') {
            const checked = (e.target as HTMLInputElement).checked;
            setFormData(prev => {
                if (name === 'save_password') {
                    return {
                        ...prev,
                        save_password: checked,
                        encrypt_password: checked ? (prev.encrypt_password ?? true) : false,
                    };
                }
                if (name === 'encrypt_password') {
                    return {
                        ...prev,
                        encrypt_password: checked && (prev.save_password ?? true),
                    };
                }
                return { ...prev, [name]: checked };
            });
        } else if (name === 'port' || name === 'connect_timeout') {
            setFormData(prev => ({ ...prev, [name]: parseInt(value) || 0 }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
        resetFeedback();
    };

    const handleParseConnectionString = (e: React.ChangeEvent<HTMLInputElement>) => {
        const uri = e.target.value;
        setConnString(uri);
        if (!uri.trim()) return;
        const updates = parseConnectionString(uri, formData.name);
        if (Object.keys(updates).length > 0) {
            setFormData(prev => ({ ...prev, ...updates }));
            resetFeedback();
        }
    };

    const handleTest = async () => {
        const err = validateConnectionForm(formData, isEditing, existingNames);
        if (err) { setErrorMsg(err); return; }
        setTesting(true);
        setErrorMsg('');
        setSuccessMsg('');
        setTestResult('idle');
        try {
            await TestConnection(new models.ConnectionProfile(formData as any));
            setSuccessMsg('Connection successful!');
            setTestResult('ok');
        } catch (err: any) {
            setErrorMsg(err.toString());
            setTestResult('error');
        } finally {
            setTesting(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        const err = validateConnectionForm(formData, isEditing, existingNames);
        if (err) { setErrorMsg(err); return; }
        setSaving(true);
        setErrorMsg('');
        try {
            await SaveConnection(new models.ConnectionProfile(formData as any));
            onSaved?.();
            onClose?.();
        } catch (err: any) {
            setErrorMsg(err.toString());
        } finally {
            setSaving(false);
        }
    };

    return {
        formData,
        connString,
        testing,
        saving,
        testResult,
        errorMsg,
        successMsg,
        isEditing,
        selectedProvider: formData.driver ?? '',
        handleDriverChange,
        handleChange,
        handleParseConnectionString,
        handleTest,
        handleSave,
        resetFeedback,
        resetForm,
    };
}

