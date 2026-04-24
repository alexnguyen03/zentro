import {
    Briefcase,
    Building2,
    Cpu,
    Factory,
    GraduationCap,
    Heart,
    Landmark,
    Layers3,
    Leaf,
    Scale,
    ShoppingCart,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Project } from '../../types/project';

const PROJECT_ICON_TAG_PREFIX = 'icon:';
const PROJECT_PINNED_TAG_VALUES = new Set(['pinned', 'pin:true']);

export type ProjectIconKey =
    | 'general'
    | 'business'
    | 'education'
    | 'healthcare'
    | 'finance'
    | 'law'
    | 'retail'
    | 'manufacturing'
    | 'environment'
    | 'technology'
    | 'public';

export interface ProjectIconOption {
    key: ProjectIconKey;
    label: string;
    icon: LucideIcon;
}

export const PROJECT_ICON_OPTIONS: ProjectIconOption[] = [
    { key: 'general', label: 'General', icon: Layers3 },
    { key: 'business', label: 'Business', icon: Briefcase },
    { key: 'education', label: 'Education', icon: GraduationCap },
    { key: 'healthcare', label: 'Healthcare', icon: Heart },
    { key: 'finance', label: 'Finance', icon: Landmark },
    { key: 'law', label: 'Law & Policy', icon: Scale },
    { key: 'retail', label: 'Retail', icon: ShoppingCart },
    { key: 'manufacturing', label: 'Manufacturing', icon: Factory },
    { key: 'environment', label: 'Environment', icon: Leaf },
    { key: 'technology', label: 'Technology', icon: Cpu },
    { key: 'public', label: 'Public Sector', icon: Building2 },
];

export const PROJECT_ICON_MAP: Record<ProjectIconKey, ProjectIconOption> = PROJECT_ICON_OPTIONS.reduce(
    (map, option) => {
        map[option.key] = option;
        return map;
    },
    {} as Record<ProjectIconKey, ProjectIconOption>,
);

export function isProjectIconKey(value: string): value is ProjectIconKey {
    return Object.prototype.hasOwnProperty.call(PROJECT_ICON_MAP, value);
}

export function formatDateLabel(value?: string): string {
    if (!value) return 'Recently updated';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Recently updated';
    return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

export function isProjectUsable(project: Project | null | undefined): boolean {
    if (!project) return false;
    return Boolean(project.connections?.length);
}

export function sortProjects(projects: Project[]): Project[] {
    return [...projects].sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''));
}

export function getProjectIconKey(project: Project | null | undefined): ProjectIconKey {
    const iconTag = project?.tags?.find((tag) => tag.startsWith(PROJECT_ICON_TAG_PREFIX));
    const raw = iconTag?.slice(PROJECT_ICON_TAG_PREFIX.length).trim();
    return raw && isProjectIconKey(raw) ? raw : 'general';
}

export function buildTagsWithProjectIcon(tags: string[] | undefined, iconKey: ProjectIconKey): string[] {
    const cleanTags = (tags || []).filter((tag) => tag && !tag.startsWith(PROJECT_ICON_TAG_PREFIX));
    return [...cleanTags, `${PROJECT_ICON_TAG_PREFIX}${iconKey}`];
}

export function isProjectPinned(project: Project | null | undefined): boolean {
    return (project?.tags || []).some((tag) => PROJECT_PINNED_TAG_VALUES.has(tag.trim().toLowerCase()));
}

export function buildTagsWithProjectPinned(tags: string[] | undefined, pinned: boolean): string[] {
    const cleanTags = (tags || []).filter((tag) => {
        const normalized = tag.trim().toLowerCase();
        return tag && !PROJECT_PINNED_TAG_VALUES.has(normalized);
    });
    if (!pinned) return cleanTags;
    return [...cleanTags, 'pinned'];
}
