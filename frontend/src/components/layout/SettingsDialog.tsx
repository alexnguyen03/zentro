import React, { useEffect, useState } from 'react';
import { X, Save } from 'lucide-react';
import { useSettingsStore } from '../../stores/settingsStore';
import { utils } from '../../../wailsjs/go/models';

export const SettingsDialog: React.FC = () => {
    const { isOpen, closeModal, theme, fontSize, defaultLimit, save } = useSettingsStore();

    const [formTheme, setFormTheme] = useState(theme);
    const [formFontSize, setFormFontSize] = useState(fontSize);
    const [formLimit, setFormLimit] = useState(defaultLimit);

    useEffect(() => {
        if (isOpen) {
            setFormTheme(theme);
            setFormFontSize(fontSize);
            setFormLimit(defaultLimit);
        }
    }, [isOpen, theme, fontSize, defaultLimit]);

    if (!isOpen) return null;

    const handleSave = () => {
        save(new utils.Preferences({
            theme: formTheme,
            font_size: formFontSize,
            default_limit: formLimit
        }));
    };

    return (
        <div className="dialog-overlay">
            <div className="dialog-content settings-dialog">
                <div className="dialog-header">
                    <h2>Zentro Settings</h2>
                    <button className="dialog-close" onClick={closeModal}><X size={18} /></button>
                </div>
                <div className="dialog-body">
                    <div className="form-group">
                        <label>Theme</label>
                        <select value={formTheme} onChange={(e) => setFormTheme(e.target.value)}>
                            <option value="system">System Default</option>
                            <option value="light">Light</option>
                            <option value="dark">Dark</option>
                        </select>
                        <span className="form-hint">Requires app restart to fully apply editor theme.</span>
                    </div>

                    <div className="form-group">
                        <label>Editor Font Size (px)</label>
                        <input
                            type="number"
                            min={10}
                            max={24}
                            value={formFontSize}
                            onChange={(e) => setFormFontSize(parseInt(e.target.value) || 14)}
                        />
                    </div>

                    <div className="form-group">
                        <label>Default Query Limit</label>
                        <select value={formLimit} onChange={(e) => setFormLimit(parseInt(e.target.value) || 1000)}>
                            <option value={100}>100 rows</option>
                            <option value={500}>500 rows</option>
                            <option value={1000}>1,000 rows</option>
                            <option value={5000}>5,000 rows</option>
                            <option value={10000}>10,000 rows</option>
                        </select>
                        <span className="form-hint">Automatically applied to SELECT queries without a LIMIT clause.</span>
                    </div>
                </div>
                <div className="dialog-footer">
                    <div className="dialog-actions" style={{ justifyContent: 'flex-end', width: '100%', marginTop: 0 }}>
                        <button className="btn" onClick={closeModal}>Cancel</button>
                        <button className="btn primary" onClick={handleSave}>
                            <Save size={14} style={{ marginRight: 6 }} /> Save
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
