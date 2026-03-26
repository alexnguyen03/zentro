import React, { useRef } from 'react';
import { Keyboard } from 'lucide-react';
import { SettingsClasses } from './SettingsStyles';

interface Props {
    profileName: string;
    onProfileNameChange: (val: string) => void;
    onExportProfile: () => void;
    onImportProfile: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
}

export const SettingsProfiles: React.FC<Props> = ({ profileName, onProfileNameChange, onExportProfile, onImportProfile }) => {
    const profileInputRef = useRef<HTMLInputElement>(null);

    return (
        <div className={SettingsClasses.section}>
            <div className={SettingsClasses.sectionInfo}>
                <div className="flex items-center gap-2.5 text-accent mb-1">
                    <Keyboard size={18} strokeWidth={2.5} />
                    <h2 className="text-[17px] font-bold tracking-tight text-text-primary">Profiles</h2>
                </div>
                <p className="text-[13px] text-text-muted leading-relaxed font-medium">
                    Export and import your theme, layout and shortcut configuration.
                </p>
            </div>
            <div className={SettingsClasses.sectionContent}>
                <div className="flex flex-col gap-2">
                    <label className={SettingsClasses.label}>Profile Name</label>
                    <input
                        className={SettingsClasses.input}
                        value={profileName}
                        onChange={(e) => onProfileNameChange(e.target.value)}
                        placeholder="Zentro Profile"
                    />
                    <span className={SettingsClasses.hint}>Used as file name and profile metadata.</span>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={onExportProfile}
                        className="px-4 py-2 text-[12px] font-semibold rounded-xl border border-border/40 bg-bg-tertiary/30 text-text-primary hover:bg-bg-tertiary/50 transition-colors"
                    >
                        Export Profile
                    </button>
                    <button
                        onClick={() => profileInputRef.current?.click()}
                        className="px-4 py-2 text-[12px] font-semibold rounded-xl border border-border/40 bg-bg-tertiary/30 text-text-primary hover:bg-bg-tertiary/50 transition-colors"
                    >
                        Import Profile
                    </button>
                    <input
                        ref={profileInputRef}
                        type="file"
                        accept=".json,.zentro-profile.json"
                        className="hidden"
                        onChange={(e) => {
                            void onImportProfile(e);
                        }}
                    />
                </div>
            </div>
        </div>
    );
};
