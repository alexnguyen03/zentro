import React, { useCallback, useRef, useState } from 'react';
import cx from 'classnames';
import { ChevronRight } from 'lucide-react';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '../../ui/collapsible';
import { Button, Spinner } from '../../ui';
import { IndexInfoView } from './IndexInfoView';
import { UniqueConstraintsView } from './UniqueConstraintsView';
import { PrimaryKeyView } from './PrimaryKeyView';
import { ForeignKeysView } from './ForeignKeysView';
import { CheckConstraintsView } from './CheckConstraintsView';
import { TabAction } from './types';

const ToolbarButton: React.FC<{ action: TabAction }> = ({ action }) => {
    if (action.render) return <>{action.render()}</>;
    if (!action.onClick || !action.icon) return null;
    return (
        <Button
            variant="ghost"
            size="icon"
            onClick={() => {
                const res = action.onClick?.();
                if (res instanceof Promise) res.catch(() => {});
            }}
            disabled={action.disabled || action.loading}
            title={action.title || action.label}
            className={cx(
                'h-7 w-7 rounded-sm p-0',
                action.danger ? 'text-destructive hover:bg-destructive/10 hover:text-destructive' : '',
            )}
        >
            {action.loading ? <Spinner size={12} /> : action.icon}
        </Button>
    );
};

interface KeysViewProps {
    schema: string;
    tableName: string;
    refreshKey: number;
    readOnlyMode?: boolean;
    isActive?: boolean;
    tableColumns?: string[];
    onDirtyCountChange?: (count: number) => void;
    driver?: string;
}

interface SectionHeaderProps {
    title: string;
    isOpen: boolean;
    onToggle: () => void;
    actions: TabAction[];
}

const SectionHeader: React.FC<SectionHeaderProps> = ({ title, isOpen, onToggle, actions }) => (
    <div className="flex items-center justify-between px-3 py-2 border-b border-border/30">
        <CollapsibleTrigger
            className="flex items-center gap-1.5 min-w-0 cursor-pointer select-none hover:opacity-80 transition-opacity"
            onClick={onToggle}
        >
            <ChevronRight
                size={13}
                className={cx('text-muted-foreground shrink-0 transition-transform duration-150', isOpen && 'rotate-90')}
            />
            <span className="text-xs font-medium text-foreground/80 uppercase tracking-wide">{title}</span>
        </CollapsibleTrigger>
        {actions.length > 0 && (
            <div className="flex items-center gap-0.5">
                {actions.map((action) => (
                    <ToolbarButton key={action.id} action={action} />
                ))}
            </div>
        )}
    </div>
);

export const KeysView: React.FC<KeysViewProps> = ({
    schema,
    tableName,
    refreshKey,
    readOnlyMode,
    isActive,
    tableColumns,
    onDirtyCountChange,
    driver,
}) => {
    const isSQLite = driver === 'sqlite';

    const [indexOpen, setIndexOpen] = useState(true);
    const [uniqueOpen, setUniqueOpen] = useState(true);
    const [uniqueConstrOpen, setUniqueConstrOpen] = useState(true);
    const [pkOpen, setPkOpen] = useState(true);
    const [fkOpen, setFkOpen] = useState(true);
    const [checkOpen, setCheckOpen] = useState(true);

    const [indexActions, setIndexActions] = useState<TabAction[]>([]);
    const [uniqueActions, setUniqueActions] = useState<TabAction[]>([]);
    const [uniqueConstrActions, setUniqueConstrActions] = useState<TabAction[]>([]);
    const [pkActions, setPkActions] = useState<TabAction[]>([]);
    const [fkActions, setFkActions] = useState<TabAction[]>([]);
    const [checkActions, setCheckActions] = useState<TabAction[]>([]);

    const dirtyRef = useRef({ index: 0, unique: 0, uniqueConstr: 0, pk: 0, fk: 0, check: 0 });

    const notifyDirty = useCallback(() => {
        const d = dirtyRef.current;
        const total = d.index + d.unique + d.uniqueConstr + d.pk + d.fk + d.check;
        onDirtyCountChange?.(total);
    }, [onDirtyCountChange]);

    const handleIndexDirty = useCallback((n: number) => { dirtyRef.current.index = n; notifyDirty(); }, [notifyDirty]);
    const handleUniqueDirty = useCallback((n: number) => { dirtyRef.current.unique = n; notifyDirty(); }, [notifyDirty]);
    const handleUniqueConstrDirty = useCallback((n: number) => { dirtyRef.current.uniqueConstr = n; notifyDirty(); }, [notifyDirty]);
    const handlePkDirty = useCallback((n: number) => { dirtyRef.current.pk = n; notifyDirty(); }, [notifyDirty]);
    const handleFkDirty = useCallback((n: number) => { dirtyRef.current.fk = n; notifyDirty(); }, [notifyDirty]);
    const handleCheckDirty = useCallback((n: number) => { dirtyRef.current.check = n; notifyDirty(); }, [notifyDirty]);

    return (
        <div className="flex flex-col flex-1 min-h-0 overflow-y-auto">

            {/* Indexes */}
            <Collapsible open={indexOpen} onOpenChange={setIndexOpen}>
                <SectionHeader
                    title="Indexes"
                    isOpen={indexOpen}
                    onToggle={() => setIndexOpen((v) => !v)}
                    actions={indexActions}
                />
                <CollapsibleContent forceMount className="data-[state=closed]:hidden">
                    <div className="border-b border-border/30" style={{ height: 280 }}>
                        <IndexInfoView
                            schema={schema}
                            tableName={tableName}
                            filterText=""
                            refreshKey={refreshKey}
                            readOnlyMode={readOnlyMode}
                            isActive={isActive && indexOpen}
                            tableColumns={tableColumns}
                            onActionsChange={setIndexActions}
                            onDirtyCountChange={handleIndexDirty}
                        />
                    </div>
                </CollapsibleContent>
            </Collapsible>

            {/* Unique Keys (index-based) */}
            <Collapsible open={uniqueOpen} onOpenChange={setUniqueOpen}>
                <SectionHeader
                    title="Unique Keys"
                    isOpen={uniqueOpen}
                    onToggle={() => setUniqueOpen((v) => !v)}
                    actions={uniqueActions}
                />
                <CollapsibleContent forceMount className="data-[state=closed]:hidden">
                    <div className="border-b border-border/30" style={{ height: 280 }}>
                        <IndexInfoView
                            schema={schema}
                            tableName={tableName}
                            filterText=""
                            refreshKey={refreshKey}
                            readOnlyMode={readOnlyMode}
                            isActive={isActive && uniqueOpen}
                            tableColumns={tableColumns}
                            onActionsChange={setUniqueActions}
                            onDirtyCountChange={handleUniqueDirty}
                            uniqueOnly
                        />
                    </div>
                </CollapsibleContent>
            </Collapsible>

            {/* Unique Constraints (hidden on SQLite) */}
            {!isSQLite && (
                <Collapsible open={uniqueConstrOpen} onOpenChange={setUniqueConstrOpen}>
                    <SectionHeader
                        title="Unique Constraints"
                        isOpen={uniqueConstrOpen}
                        onToggle={() => setUniqueConstrOpen((v) => !v)}
                        actions={uniqueConstrActions}
                    />
                    <CollapsibleContent forceMount className="data-[state=closed]:hidden">
                        <div className="border-b border-border/30">
                            <UniqueConstraintsView
                                schema={schema}
                                tableName={tableName}
                                refreshKey={refreshKey}
                                readOnlyMode={readOnlyMode}
                                isActive={isActive && uniqueConstrOpen}
                                tableColumns={tableColumns}
                                onActionsChange={setUniqueConstrActions}
                                onDirtyCountChange={handleUniqueConstrDirty}
                            />
                        </div>
                    </CollapsibleContent>
                </Collapsible>
            )}

            {/* Primary Key */}
            <Collapsible open={pkOpen} onOpenChange={setPkOpen}>
                <SectionHeader
                    title="Primary Key"
                    isOpen={pkOpen}
                    onToggle={() => setPkOpen((v) => !v)}
                    actions={pkActions}
                />
                <CollapsibleContent forceMount className="data-[state=closed]:hidden">
                    <div className="border-b border-border/30">
                        <PrimaryKeyView
                            schema={schema}
                            tableName={tableName}
                            refreshKey={refreshKey}
                            readOnlyMode={readOnlyMode}
                            isActive={isActive && pkOpen}
                            tableColumns={tableColumns}
                            onActionsChange={setPkActions}
                            onDirtyCountChange={handlePkDirty}
                            driver={driver}
                        />
                    </div>
                </CollapsibleContent>
            </Collapsible>

            {/* Foreign Keys (hidden on SQLite) */}
            {!isSQLite && (
                <Collapsible open={fkOpen} onOpenChange={setFkOpen}>
                    <SectionHeader
                        title="Foreign Keys"
                        isOpen={fkOpen}
                        onToggle={() => setFkOpen((v) => !v)}
                        actions={fkActions}
                    />
                    <CollapsibleContent forceMount className="data-[state=closed]:hidden">
                        <div className="border-b border-border/30">
                            <ForeignKeysView
                                schema={schema}
                                tableName={tableName}
                                refreshKey={refreshKey}
                                readOnlyMode={readOnlyMode}
                                isActive={isActive && fkOpen}
                                tableColumns={tableColumns}
                                onActionsChange={setFkActions}
                                onDirtyCountChange={handleFkDirty}
                            />
                        </div>
                    </CollapsibleContent>
                </Collapsible>
            )}

            {/* Check Constraints */}
            <Collapsible open={checkOpen} onOpenChange={setCheckOpen}>
                <SectionHeader
                    title="Check Constraints"
                    isOpen={checkOpen}
                    onToggle={() => setCheckOpen((v) => !v)}
                    actions={checkActions}
                />
                <CollapsibleContent forceMount className="data-[state=closed]:hidden">
                    <div className="border-b border-border/30">
                        <CheckConstraintsView
                            schema={schema}
                            tableName={tableName}
                            refreshKey={refreshKey}
                            readOnlyMode={readOnlyMode}
                            isActive={isActive && checkOpen}
                            onActionsChange={setCheckActions}
                            onDirtyCountChange={handleCheckDirty}
                        />
                    </div>
                </CollapsibleContent>
            </Collapsible>

        </div>
    );
};
