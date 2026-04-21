import React from 'react';
import { AlertCircle, Copy, FilePlus, Play } from 'lucide-react';
import { Button, Checkbox, Input, Label, Modal, RadioGroup, RadioGroupItem, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui';

interface ResultPanelModalsProps {
    showSaveModal: boolean;
    setShowSaveModal: React.Dispatch<React.SetStateAction<boolean>>;
    showExportModal: boolean;
    setShowExportModal: React.Dispatch<React.SetStateAction<boolean>>;
    qualifiedTableName: string;
    resultTableName?: string;
    generatePendingScript: () => string;
    handleCopyScript: () => void;
    handleOpenInNewTab: () => void;
    handleDirectExecute: () => Promise<void>;
    exportScope: 'all' | 'view';
    setExportScope: React.Dispatch<React.SetStateAction<'all' | 'view'>>;
    exportFormat: 'csv' | 'json' | 'sql';
    setExportFormat: React.Dispatch<React.SetStateAction<'csv' | 'json' | 'sql'>>;
    exportTableName: string;
    setExportTableName: React.Dispatch<React.SetStateAction<string>>;
    allExportColumns: string[];
    orderedSelectedExportColumns: string[];
    selectedExportColumnSet: Set<string>;
    toggleExportColumn: (column: string) => void;
    toggleAllExportColumns: () => void;
    areAllExportColumnsSelected: boolean;
    previewExportRows: string[][];
    handleConfirmExport: () => void;
    writeSafetyModals?: React.ReactNode;
}

export const ResultPanelModals: React.FC<ResultPanelModalsProps> = ({
    showSaveModal,
    setShowSaveModal,
    showExportModal,
    setShowExportModal,
    qualifiedTableName,
    resultTableName,
    generatePendingScript,
    handleCopyScript,
    handleOpenInNewTab,
    handleDirectExecute,
    exportScope,
    setExportScope,
    exportFormat,
    setExportFormat,
    exportTableName,
    setExportTableName,
    allExportColumns,
    orderedSelectedExportColumns,
    selectedExportColumnSet,
    toggleExportColumn,
    toggleAllExportColumns,
    areAllExportColumnsSelected,
    previewExportRows,
    handleConfirmExport,
    writeSafetyModals,
}) => (
    <>
        <Modal
            isOpen={showSaveModal}
            onClose={() => setShowSaveModal(false)}
            title="Confirm Changes"
            width={560}
            footer={(
                <>
                    <Button variant="ghost" size="icon" onClick={handleCopyScript} title="Copy Script"><Copy size={14} /></Button>
                    <Button variant="ghost" size="icon" onClick={handleOpenInNewTab} title="Open in New Tab"><FilePlus size={14} /></Button>
                    <Button variant="default" onClick={() => { void handleDirectExecute(); }} title="Execute Changes" autoFocus className="px-6">
                        <Play size={14} className="mr-2" />Execute Changes
                    </Button>
                </>
            )}
        >
            <div>
                <div className="flex items-start gap-4 mb-4">
                    <div className="shrink-0 p-2 rounded-full bg-accent/10"><AlertCircle size={20} className="text-accent" /></div>
                    <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-foreground mb-1">Review generated script</p>
                        <p className="text-[12px] leading-relaxed text-muted-foreground">
                            Updates and deletes require confirmation. Pending inserts will be executed together with this script for <strong>{qualifiedTableName || resultTableName}</strong>.
                        </p>
                    </div>
                </div>
                <div className="p-3 bg-muted/50 border border-border/40 rounded-sm font-mono text-[11px] max-h-[260px] overflow-y-auto whitespace-pre-wrap text-muted-foreground select-text">
                    {generatePendingScript()}
                </div>
            </div>
        </Modal>

        {writeSafetyModals}

        <Modal
            isOpen={showExportModal}
            onClose={() => setShowExportModal(false)}
            title="Export Options"
            width={920}
            footer={(
                <>
                    <Button variant="ghost" onClick={() => setShowExportModal(false)}>Cancel</Button>
                    <Button variant="default" onClick={handleConfirmExport} autoFocus>Export</Button>
                </>
            )}
        >
            <div className="grid grid-cols-12 gap-4">
                <section className="col-span-12 lg:col-span-5 space-y-4">
                    <div>
                        <p className="text-[12px] font-semibold text-foreground mb-2">Extraction</p>
                        <RadioGroup
                            value={exportScope}
                            onValueChange={(value) => setExportScope(value as 'all' | 'view')}
                            className="gap-2"
                        >
                            <div className="flex items-center gap-2 text-[12px] text-foreground">
                                <RadioGroupItem value="all" id="export_scope_all" />
                                <Label htmlFor="export_scope_all" className="text-[12px] font-normal text-foreground">
                                    Query the database (no paging)
                                </Label>
                            </div>
                            <div className="flex items-center gap-2 text-[12px] text-foreground">
                                <RadioGroupItem value="view" id="export_scope_view" />
                                <Label htmlFor="export_scope_view" className="text-[12px] font-normal text-foreground">
                                    Use fetched rows (current table view)
                                </Label>
                            </div>
                        </RadioGroup>
                    </div>

                    <div>
                        <label className="block text-[12px] font-semibold text-foreground mb-1.5">Format</label>
                        <Select
                            value={exportFormat}
                            onValueChange={(value) => setExportFormat(value as 'csv' | 'json' | 'sql')}
                        >
                            <SelectTrigger className="w-full bg-background text-small">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="csv">CSV</SelectItem>
                                <SelectItem value="json">JSON</SelectItem>
                                <SelectItem value="sql">SQL INSERT</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {exportFormat === 'sql' && (
                        <div>
                            <label className="block text-[12px] font-semibold text-foreground mb-1.5">Table Name</label>
                            <Input
                                type="text"
                                size="md"
                                className="w-full"
                                placeholder={resultTableName || 'my_table'}
                                value={exportTableName}
                                onChange={(event) => setExportTableName(event.target.value)}
                            />
                            <p className="text-[11px] text-muted-foreground mt-1.5">
                                Leave empty to use "{resultTableName || 'my_table'}"
                            </p>
                        </div>
                    )}

                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="text-[12px] font-semibold text-foreground">Columns</label>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-auto px-1 py-0.5 text-[11px] text-muted-foreground hover:text-foreground"
                                onClick={toggleAllExportColumns}
                            >
                                {areAllExportColumnsSelected ? 'Clear all' : 'Select all'}
                            </Button>
                        </div>
                        <div className="max-h-44 overflow-auto rounded-sm border border-border/50 bg-background p-2 space-y-1">
                            {allExportColumns.map((column) => (
                                <label key={column} className="flex items-center gap-2 text-[12px] text-foreground">
                                    <Checkbox
                                        checked={selectedExportColumnSet.has(column)}
                                        onCheckedChange={() => toggleExportColumn(column)}
                                    />
                                    <span className="truncate" title={column}>{column}</span>
                                </label>
                            ))}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-1.5">
                            {orderedSelectedExportColumns.length}/{allExportColumns.length} columns selected
                        </p>
                    </div>
                </section>

                <section className="col-span-12 lg:col-span-7">
                    <div className="flex items-center justify-between mb-1.5">
                        <p className="text-[12px] font-semibold text-foreground">Preview (10 rows)</p>
                        <p className="text-[11px] text-muted-foreground">
                            Showing loaded rows preview only
                        </p>
                    </div>
                    <div className="rounded-sm border border-border/50 bg-background overflow-auto max-h-[360px]">
                        {orderedSelectedExportColumns.length === 0 ? (
                            <div className="px-3 py-8 text-[12px] text-muted-foreground text-center">
                                Select at least one column to preview.
                            </div>
                        ) : previewExportRows.length === 0 ? (
                            <div className="px-3 py-8 text-[12px] text-muted-foreground text-center">
                                No loaded rows to preview.
                            </div>
                        ) : (
                            <table className="w-full text-[11px] border-collapse">
                                <thead className="sticky top-0 bg-card">
                                    <tr>
                                        {orderedSelectedExportColumns.map((column) => (
                                            <th key={column} className="text-left px-2 py-1.5 border-b border-border/60 whitespace-nowrap">
                                                {column}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {previewExportRows.map((row, rowIdx) => (
                                        <tr key={`preview_${rowIdx}`} className="odd:bg-background even:bg-card/30">
                                            {row.map((cell, cellIdx) => (
                                                <td key={`preview_${rowIdx}_${cellIdx}`} className="px-2 py-1.5 border-b border-border/20 whitespace-nowrap max-w-[220px] overflow-hidden text-ellipsis">
                                                    {cell}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </section>
            </div>
        </Modal>
    </>
);
