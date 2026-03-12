import React, { useEffect, useState, useCallback } from 'react';
import {
    ReactFlow,
    Background,
    Controls,
    useNodesState,
    useEdgesState,
    Node,
    Edge,
    MarkerType,
    NodeTypes,
    Handle,
    Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { FetchTableRelationships, FetchTableColumns } from '../../../wailsjs/go/app/App';
import { Loader } from 'lucide-react';

const TableNode = ({ data }: any) => {
    return (
        <div style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: 6,
            minWidth: 200,
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            overflow: 'hidden'
        }}>
            {/* Target handle on left for incoming edges */}
            <Handle type="target" position={Position.Left} style={{ background: 'var(--accent-color)' }} />
            
            {/* Header */}
            <div style={{
                background: 'var(--bg-tertiary)',
                padding: '8px 12px',
                borderBottom: '1px solid var(--border-color)',
                fontWeight: 600,
                fontSize: 13,
                color: 'var(--text-primary)'
            }}>
                {data.label}
            </div>
            
            {/* Columns */}
            <div style={{ padding: '4px 0' }}>
                {data.columns?.map((c: any, i: number) => (
                    <div key={i} style={{
                        padding: '4px 12px',
                        fontSize: 12,
                        display: 'flex',
                        justifyContent: 'space-between',
                        color: 'var(--text-secondary)'
                    }}>
                        <span style={{ color: c.isPk ? 'var(--accent-color)' : 'inherit', fontWeight: c.isPk ? 600 : 'normal' }}>
                            {c.name}
                        </span>
                        <span style={{ opacity: 0.6, fontSize: 11, marginLeft: 16 }}>{c.type}</span>
                    </div>
                ))}
                {(!data.columns || data.columns.length === 0) && (
                    <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                        Loading columns...
                    </div>
                )}
            </div>

            {/* Source handle on right for outgoing edges */}
            <Handle type="source" position={Position.Right} style={{ background: 'var(--success-color)' }} />
        </div>
    );
};

const nodeTypes: NodeTypes = {
    tableNode: TableNode,
};

interface ErdViewProps {
    schema: string;
    table: string;
    onCountChange?: (count: number) => void;
}

export const ErdView: React.FC<ErdViewProps> = ({ schema, table, onCountChange }) => {
    const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const loadErd = useCallback(async () => {
        try {
            setLoading(true);
            setError('');
            
            const rels = await FetchTableRelationships(schema, table);
            if (onCountChange) {
                onCountChange(rels ? rels.length : 0);
            }

            const relatedTables = new Set<string>();
            relatedTables.add(table); 
            if (rels) {
                rels.forEach((r: any) => {
                    relatedTables.add(r.SourceTable);
                    relatedTables.add(r.TargetTable);
                });
            }

            const columnsMap = new Map<string, any[]>();
            await Promise.all(Array.from(relatedTables).map(async (t) => {
                let s = schema;
                if (rels && t !== table) {
                    const r: any = rels.find((rel: any) => rel.SourceTable === t || rel.TargetTable === t);
                    if (r) {
                        s = r.SourceTable === t ? r.SourceSchema : r.TargetSchema;
                    }
                }
                try {
                    const cols = await FetchTableColumns(s, t);
                    columnsMap.set(t, cols.map((c: any) => ({
                        name: c.Name,
                        type: c.DataType,
                        isPk: c.IsPrimaryKey,
                    })));
                } catch {
                    columnsMap.set(t, []);
                }
            }));

            const newNodes: Node[] = [];
            const newEdges: Edge[] = [];
            
            newNodes.push({
                id: table,
                type: 'tableNode',
                position: { x: 400, y: 300 },
                data: { label: table, columns: columnsMap.get(table) || [] },
            });

            let parentY = 50;
            let childY = 50;
            const addedNodeIds = new Set<string>([table]);

            if (rels) {
                rels.forEach((r: any) => {
                    if (r.SourceTable === table && r.TargetTable !== table) {
                        if (!addedNodeIds.has(r.TargetTable)) {
                            newNodes.push({
                                id: r.TargetTable,
                                type: 'tableNode',
                                position: { x: 50, y: parentY },
                                data: { label: r.TargetTable, columns: columnsMap.get(r.TargetTable) || [] },
                            });
                            addedNodeIds.add(r.TargetTable);
                            parentY += 250;
                        }

                        newEdges.push({
                            id: r.ConstraintName,
                            source: table,
                            target: r.TargetTable,
                            label: `${r.SourceColumn} → ${r.TargetColumn}`,
                            markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--text-secondary)' },
                            style: { stroke: 'var(--text-secondary)' },
                            animated: true,
                        });
                    } else if (r.TargetTable === table && r.SourceTable !== table) {
                        if (!addedNodeIds.has(r.SourceTable)) {
                            newNodes.push({
                                id: r.SourceTable,
                                type: 'tableNode',
                                position: { x: 750, y: childY },
                                data: { label: r.SourceTable, columns: columnsMap.get(r.SourceTable) || [] },
                            });
                            addedNodeIds.add(r.SourceTable);
                            childY += 250;
                        }

                        newEdges.push({
                            id: r.ConstraintName,
                            source: r.SourceTable,
                            target: table,
                            label: `${r.SourceColumn} → ${r.TargetColumn}`,
                            markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--text-secondary)' },
                            style: { stroke: 'var(--text-secondary)' },
                            animated: true,
                        });
                    } else if (r.SourceTable === table && r.TargetTable === table) {
                        newEdges.push({
                            id: r.ConstraintName,
                            source: table,
                            target: table,
                            label: `${r.SourceColumn} → ${r.TargetColumn}`,
                            markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--text-secondary)' },
                            style: { stroke: 'var(--text-secondary)' },
                            animated: true,
                        });
                    }
                });
            }

            setNodes(newNodes);
            setEdges(newEdges);
            setLoading(false);
        } catch (e: any) {
            setError(e.toString());
            setLoading(false);
        }
    }, [schema, table, setNodes, setEdges, onCountChange]);

    useEffect(() => {
        loadErd();
    }, [loadErd]);

    if (loading) {
        return (
            <div className="flex items-center gap-2 p-5 h-full" style={{ background: 'var(--bg-main)' }}>
                <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> Loading ERD...
            </div>
        );
    }

    if (error) {
        return <div className="p-5 h-full" style={{ color: 'var(--error-color)', background: 'var(--bg-main)' }}>{error}</div>;
    }

    return (
        <div className="flex-1 w-full h-full min-h-0 relative" style={{ background: 'var(--bg-main)' }}>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                nodeTypes={nodeTypes}
                fitView
                fitViewOptions={{ padding: 0.3 }}
                minZoom={0.1}
                maxZoom={2}
                colorMode="dark"
            >
                <Background color="#333" gap={20} />
                <Controls style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }} />
            </ReactFlow>
        </div>
    );
};
