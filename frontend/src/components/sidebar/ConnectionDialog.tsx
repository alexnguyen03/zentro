import React, { useState, useEffect } from 'react';
import { models } from '../../../wailsjs/go/models';
import { SaveConnection, TestConnection } from '../../../wailsjs/go/app/App';

type ConnectionProfile = models.ConnectionProfile;

interface ConnectionDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
    profile?: ConnectionProfile | null;
}

export const ConnectionDialog: React.FC<ConnectionDialogProps> = ({ isOpen, onClose, onSave, profile }) => {
    const [formData, setFormData] = useState<Partial<ConnectionProfile>>({
        driver: 'postgres',
        host: 'localhost',
        port: 5432,
        ssl_mode: 'disable'
    });

    const [testing, setTesting] = useState(false);
    const [saving, setSaving] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    useEffect(() => {
        if (isOpen) {
            if (profile) {
                setFormData({ ...profile });
            } else {
                setFormData({
                    driver: 'postgres',
                    host: 'localhost',
                    port: 5432,
                    ssl_mode: 'disable',
                    name: '',
                    username: '',
                    password: '',
                    db_name: ''
                });
            }
            setErrorMsg('');
            setSuccessMsg('');
        }
    }, [isOpen, profile]);

    if (!isOpen) return null;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: name === 'port' || name === 'connect_timeout' ? parseInt(value) || 0 : value
        }));
    };

    const handleTest = async () => {
        setTesting(true);
        setErrorMsg('');
        setSuccessMsg('');
        try {
            await TestConnection(new models.ConnectionProfile(formData as any));
            setSuccessMsg('Connection successful!');
        } catch (err: any) {
            setErrorMsg(err.toString());
        } finally {
            setTesting(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name) {
            setErrorMsg('Profile name is required');
            return;
        }
        setSaving(true);
        setErrorMsg('');
        try {
            await SaveConnection(new models.ConnectionProfile(formData as any));
            onSave(); // Refresh list via parent
            onClose();
        } catch (err: any) {
            setErrorMsg(err.toString());
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="dialog-overlay">
            <div className="dialog-content">
                <h3>{profile ? 'Edit Connection' : 'New Connection'}</h3>

                <form onSubmit={handleSave} className="connection-form">
                    <div className="form-group">
                        <label>Profile Name <span style={{ color: 'var(--error-color)' }}>*</span></label>
                        <input name="name" value={formData.name || ''} onChange={handleChange} required autoFocus />
                    </div>

                    <div className="form-group">
                        <label>Driver</label>
                        <select name="driver" value={formData.driver || 'postgres'} onChange={handleChange}>
                            <option value="postgres">PostgreSQL</option>
                            {/* <option value="mysql">MySQL</option> */}
                        </select>
                    </div>

                    <div className="form-row">
                        <div className="form-group" style={{ flex: 2 }}>
                            <label>Host</label>
                            <input name="host" value={formData.host || ''} onChange={handleChange} required />
                        </div>
                        <div className="form-group" style={{ flex: 1 }}>
                            <label>Port</label>
                            <input type="number" name="port" value={formData.port || 5432} onChange={handleChange} required />
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>Username</label>
                            <input name="username" value={formData.username || ''} onChange={handleChange} required />
                        </div>
                        <div className="form-group">
                            <label>Password</label>
                            <input type="password" name="password" value={formData.password || ''} onChange={handleChange} />
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>Database Name</label>
                            <input name="db_name" value={formData.db_name || ''} onChange={handleChange} required />
                        </div>
                        <div className="form-group">
                            <label>SSL Mode</label>
                            <select name="ssl_mode" value={formData.ssl_mode || 'disable'} onChange={handleChange}>
                                <option value="disable">Disable</option>
                                <option value="require">Require</option>
                                <option value="verify-ca">Verify CA</option>
                                <option value="verify-full">Verify Full</option>
                            </select>
                        </div>
                    </div>

                    {errorMsg && <div className="error-message">{errorMsg}</div>}
                    {successMsg && <div className="success-message">{successMsg}</div>}

                    <div className="dialog-actions">
                        <button type="button" className="btn" onClick={handleTest} disabled={testing}>
                            {testing ? 'Testing...' : 'Test'}
                        </button>
                        <div style={{ flex: 1 }}></div>
                        <button type="button" className="btn" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn primary" disabled={saving}>
                            {saving ? 'Saving...' : 'Save'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
