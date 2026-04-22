import React, { useMemo, useState } from 'react';
import { MessageSquareWarning } from 'lucide-react';
import { BrowserOpenURL } from '../../../../wailsjs/runtime/runtime';
import { SettingsClasses } from './SettingsStyles';
import {
    Button,
    Input,
    Label,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Textarea,
} from '../../ui';

type FeedbackKind = 'feedback' | 'bug' | 'feature';

interface Props {
    environmentLabel: string;
}

const REPO_ISSUE_URL = 'https://github.com/alexnguyen03/zentro/issues/new';

const FEEDBACK_KIND_META: Record<FeedbackKind, { label: string; defaultTitle: string; buttonText: string; helper: string }> = {
    feedback: {
        label: 'feedback',
        defaultTitle: 'Product feedback',
        buttonText: 'Send Feedback',
        helper: 'Share UX pain points, rough edges, or ideas to improve day-to-day flow.',
    },
    bug: {
        label: 'bug',
        defaultTitle: 'Bug report',
        buttonText: 'Create Bug Issue',
        helper: 'Describe the problem, expected behavior, and exact steps to reproduce.',
    },
    feature: {
        label: 'enhancement',
        defaultTitle: 'Feature request',
        buttonText: 'Create Feature Issue',
        helper: 'Describe what you want to add and why that change would help your workflow.',
    },
};

function buildIssueBody(kind: FeedbackKind, details: string, environmentLabel: string) {
    const introByKind: Record<FeedbackKind, string> = {
        feedback: '## Feedback',
        bug: '## Bug Details',
        feature: '## Feature Request',
    };
    const timestamp = new Date().toISOString();
    const detailsValue = details.trim() || '_No details provided yet._';

    return [
        introByKind[kind],
        '',
        detailsValue,
        '',
        '## Context',
        `- Environment: ${environmentLabel}`,
        `- Submitted At: ${timestamp}`,
        '',
    ].join('\n');
}

export const SettingsFeedback: React.FC<Props> = ({ environmentLabel }) => {
    const [kind, setKind] = useState<FeedbackKind>('feedback');
    const [title, setTitle] = useState('');
    const [details, setDetails] = useState('');
    const kindMeta = useMemo(() => FEEDBACK_KIND_META[kind], [kind]);

    const handleOpenIssue = () => {
        const finalTitle = title.trim() || `${kindMeta.defaultTitle} (${environmentLabel})`;
        const body = buildIssueBody(kind, details, environmentLabel);
        const params = new URLSearchParams({
            title: finalTitle,
            body,
            labels: kindMeta.label,
        });
        BrowserOpenURL(`${REPO_ISSUE_URL}?${params.toString()}`);
    };

    return (
        <div className={SettingsClasses.section}>
            <div className={SettingsClasses.sectionInfo}>
                <div className="mb-1 flex items-center gap-2.5 text-accent">
                    <MessageSquareWarning size={18} strokeWidth={2.5} />
                    <h2 className={SettingsClasses.sectionTitle}>Feedback & Issue</h2>
                </div>
                <p className={SettingsClasses.sectionDescription}>
                    Send feedback or open a GitHub issue with prefilled context.
                </p>
            </div>
            <div className={SettingsClasses.sectionContent}>
                <div className="space-y-1.5">
                    <Label>Type</Label>
                    <Select value={kind} onValueChange={(value) => setKind(value as FeedbackKind)}>
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="feedback">Feedback</SelectItem>
                            <SelectItem value="bug">Bug</SelectItem>
                            <SelectItem value="feature">Feature Request</SelectItem>
                        </SelectContent>
                    </Select>
                    <p className="text-label text-muted-foreground">{kindMeta.helper}</p>
                </div>

                <div className="space-y-1.5">
                    <Label>Title</Label>
                    <Input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder={kindMeta.defaultTitle}
                    />
                    <p className="text-label text-muted-foreground">Leave blank to use an auto-generated title.</p>
                </div>

                <div className="space-y-1.5">
                    <Label>Details</Label>
                    <Textarea
                        value={details}
                        onChange={(e) => setDetails(e.target.value)}
                        rows={5}
                        placeholder="What happened, what you expected, and any useful context..."
                    />
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                    <Button type="button" variant="outline" size="sm" onClick={handleOpenIssue}>
                        {kindMeta.buttonText}
                    </Button>
                </div>
            </div>
        </div>
    );
};
