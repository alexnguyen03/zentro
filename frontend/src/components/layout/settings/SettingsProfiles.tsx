import React, { useRef } from 'react';
import { Keyboard } from 'lucide-react';
import { SettingsClasses } from './SettingsStyles';
import { Button, FormField, Input } from '../../ui';

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
                    <h2 className={SettingsClasses.sectionTitle}>Profiles</h2>
                </div>
                <p className={SettingsClasses.sectionDescription}>
                    Export and import your theme, layout and shortcut configuration.
                </p>
            </div>
            <div className={SettingsClasses.sectionContent}>
                <FormField label="Profile Name" hint="Used as file name and profile metadata.">
                    <Input
                        value={profileName}
                        onChange={(e) => onProfileNameChange(e.target.value)}
                        placeholder="Zentro Profile"
                    />
                </FormField>

                <div className="flex flex-wrap items-center gap-2.5">
                    <Button
                        onClick={onExportProfile}
                        variant="ghost"
                        size="sm"
                    >
                        Export Profile
                    </Button>
                    <Button
                        onClick={() => profileInputRef.current?.click()}
                        variant="ghost"
                        size="sm"
                    >
                        Import Profile
                    </Button>
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
