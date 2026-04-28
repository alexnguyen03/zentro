import React, { useCallback, useMemo, useState } from 'react';
import { cn } from '../../../lib/cn';
import { useShortcutStore } from '../../../stores/shortcutStore';
import { useEditorStore } from '../../../stores/editorStore';
import { useUpdateCheck } from '../../../hooks/useUpdateCheck';
import { useToast } from '../Toast';
import type { AppMenuItem } from './appMenuSections';
import { buildAppMenuSections } from './appMenuSections';
import type { CommandId } from '../../../lib/shortcutRegistry';
import {
    Button,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuPortal,
    DropdownMenuShortcut,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
} from '../../ui';

interface AppMenuProps {
    /** Logo element placed as the trigger button content */
    trigger: React.ReactNode;
    onOpenAbout: () => void;
    onOpenLicense: () => void;
    onOpenUpdateModal: (open: boolean) => void;
    hasUpdate: boolean;
    updateInfo: ReturnType<typeof useUpdateCheck>['updateInfo'];
    isChecking: boolean;
    check: ReturnType<typeof useUpdateCheck>['check'];
    dismiss: ReturnType<typeof useUpdateCheck>['dismiss'];
}

export const AppMenu: React.FC<AppMenuProps> = ({
    trigger,
    onOpenAbout,
    onOpenLicense,
    onOpenUpdateModal,
    hasUpdate,
    isChecking,
    check,
    dismiss: _dismiss,
}) => {
    const shortcutBindings = useShortcutStore((s) => s.bindings);
    const { groups, activeGroupId } = useEditorStore();
    const { toast } = useToast();
    const [open, setOpen] = useState(false);
    const menuItemClassName = 'h-7 px-2 py-0 text-small leading-none';
    const dangerTextClassName = '[color:var(--destructive)]';
    const dangerMutedTextClassName = '[color:color-mix(in_srgb,var(--destructive)_70%,transparent)]';

    const activeGroup = groups.find((g) => g.id === activeGroupId);
    const activeTab = activeGroup?.tabs.find((t) => t.id === activeGroup.activeTabId);
    const isQueryTab = activeTab?.type === 'query';

    const getShortcut = useCallback((commandId: CommandId) => shortcutBindings[commandId] || '', [shortcutBindings]);

    const handleManualCheckForUpdates = useCallback(async () => {
        const result = await check(true);
        if (result === undefined) { toast.error('Could not check for updates.'); return; }
        if (result?.has_update) { onOpenUpdateModal(true); return; }
        toast.success('You are already on the latest version.');
    }, [check, onOpenUpdateModal, toast]);

    const sections = useMemo(
        () => buildAppMenuSections({
            getShortcut,
            isQueryTab,
            isChecking,
            hasUpdate,
            onCheckForUpdates: handleManualCheckForUpdates,
            onOpenAbout,
            onOpenLicense,
        }),
        [getShortcut, isQueryTab, isChecking, hasUpdate, handleManualCheckForUpdates, onOpenAbout, onOpenLicense],
    );

    const selectItem = useCallback((item: AppMenuItem) => {
        if (item.disabled) return;
        Promise.resolve(item.action()).catch((err) => toast.error(`Action failed: ${err}`));
    }, [toast]);

    return (
        <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
            <DropdownMenuTrigger asChild>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className={cn('relative mr-1 size-6 hover:opacity-80', open && 'bg-muted text-foreground')}
                    title="Open app menu"
                    aria-label="Open app menu"
                >
                    {trigger}
                    {hasUpdate && (
                        <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full border border-background bg-success animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                    )}
                </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="start" sideOffset={6} className="z-toolbar w-[168px] p-1">
                <DropdownMenuGroup className="flex flex-col gap-0.5">
                    {sections.map((section) => (
                        <DropdownMenuSub key={section.id}>
                            <DropdownMenuSubTrigger
                                className={cn(
                                    menuItemClassName,
                                    'font-normal text-popover-foreground h-7 px-2 py-0 text-small leading-none data-[state=open]:text-popover-foreground',
                                )}
                            >
                                {section.title}
                            </DropdownMenuSubTrigger>
                            <DropdownMenuPortal>
                                <DropdownMenuSubContent sideOffset={4} className="z-[calc(var(--layer-toolbar)+1)] w-[280px] p-1">
                                    <DropdownMenuGroup className="flex flex-col gap-0.5">
                                        {section.items.map((item) => (
                                            <DropdownMenuItem
                                                key={item.id}
                                                disabled={item.disabled}
                                                onSelect={() => selectItem(item)}
                                                className={cn(
                                                    menuItemClassName,
                                                    'gap-2',
                                                    item.danger && [
                                                        dangerTextClassName,
                                                        'focus:bg-destructive/10 focus:[color:var(--destructive)]',
                                                        'data-[highlighted]:bg-destructive/10 data-[highlighted]:[color:var(--destructive)]',
                                                    ],
                                                )}
                                            >
                                                <span className="inline-flex items-center gap-1.5">
                                                    <span>{item.label}</span>
                                                    {item.hasBadge && <span className="size-1.5 rounded-full bg-success animate-pulse" />}
                                                </span>
                                                {item.shortcut && (
                                                    <DropdownMenuShortcut className={cn('text-label', item.danger && dangerMutedTextClassName)}>
                                                        {item.shortcut}
                                                    </DropdownMenuShortcut>
                                                )}
                                            </DropdownMenuItem>
                                        ))}
                                    </DropdownMenuGroup>
                                </DropdownMenuSubContent>
                            </DropdownMenuPortal>
                        </DropdownMenuSub>
                    ))}
                </DropdownMenuGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    );
};
