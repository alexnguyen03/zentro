import React, { useEffect, useState, useCallback } from 'react';
import {
    ReactFlow,
    Background,
    useNodesState,
    useEdgesState,
    Node,
    Edge,
    NodeTypes,
    EdgeTypes,
    Handle,
    Position,
    BaseEdge,
    EdgeLabelRenderer,
    getSmoothStepPath,
    EdgeProps,
    useStore,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { FetchTableRelationships, FetchTableColumns } from '../../../wailsjs/go/app/App';
import { Loader } from 'lucide-react';
import { useSettingsStore } from '../../stores/settingsStore';

interface ErdEdgeData extends Record<string, unknown> {
    label?: string;
    sourceCardinality?: string;
    targetCardinality?: string;
}

function getIntersection(n1: any, n2: any) {
    if (!n1 || !n2 || !n1.measured?.width || !n2.measured?.width) {
        return { x: 0, y: 0 };
    }
    const w = n1.measured.width / 2;
    const h = n1.measured.height / 2;
    const x1 = (n1.internals?.positionAbsolute?.x ?? n1.positionAbsolute?.x ?? n1.position?.x) + w;
    const y1 = (n1.internals?.positionAbsolute?.y ?? n1.positionAbsolute?.y ?? n1.position?.y) + h;
    
    const x2 = (n2.internals?.positionAbsolute?.x ?? n2.positionAbsolute?.x ?? n2.position?.x) + n2.measured.width / 2;
    const y2 = (n2.internals?.positionAbsolute?.y ?? n2.positionAbsolute?.y ?? n2.position?.y) + n2.measured.height / 2;

    const dx = x2 - x1;
    const dy = y2 - y1;

    if (dx === 0 && dy === 0) return { x: x1, y: y1 };

    let x = 0, y = 0;
    if (Math.abs(dx) * h > Math.abs(dy) * w) {
        x = x1 + (dx > 0 ? w : -w);
        y = y1 + dy * Math.abs(w / dx);
    } else {
        y = y1 + (dy > 0 ? h : -h);
        x = x1 + dx * Math.abs(h / dy);
    }
    return { x, y };
}

function getPosition(n: any, point: { x: number, y: number }) {
    if (!n || !n.measured?.width) return Position.Left;
    const w = n.measured.width / 2;
    const h = n.measured.height / 2;
    const cx = (n.internals?.positionAbsolute?.x ?? n.positionAbsolute?.x ?? n.position?.x) + w;
    const cy = (n.internals?.positionAbsolute?.y ?? n.positionAbsolute?.y ?? n.position?.y) + h;
    const dx = point.x - cx;
    const dy = point.y - cy;
    if (Math.abs(dx) > Math.abs(dy)) {
        return dx > 0 ? Position.Right : Position.Left;
    } else {
        return dy > 0 ? Position.Bottom : Position.Top;
    }
}

const ErdEdge = ({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    source,
    target,
    style = {},
    data,
}: EdgeProps) => {
    const edgeData = data as ErdEdgeData;
    
    const sourceNode = useStore((s: any) => s.nodeLookup?.get(source) || s.nodeInternals?.get(source));
    const targetNode = useStore((s: any) => s.nodeLookup?.get(target) || s.nodeInternals?.get(target));

    let p1 = { x: sourceX, y: sourceY };
    let p2 = { x: targetX, y: targetY };
    let sPos = sourcePosition;
    let tPos = targetPosition;

    if (sourceNode && targetNode) {
        if (source === target) {
            const w = sourceNode.measured?.width || 200;
            const h = sourceNode.measured?.height || 100;
            const px = sourceNode.internals?.positionAbsolute?.x ?? sourceNode.positionAbsolute?.x ?? sourceNode.position?.x ?? 0;
            const py = sourceNode.internals?.positionAbsolute?.y ?? sourceNode.positionAbsolute?.y ?? sourceNode.position?.y ?? 0;
            p1 = { x: px + w, y: py + 40 };
            sPos = Position.Right;
            p2 = { x: px + 40, y: py + h };
            tPos = Position.Bottom;
        } else {
            const intersection1 = getIntersection(sourceNode, targetNode);
            const intersection2 = getIntersection(targetNode, sourceNode);
            if (intersection1.x !== 0 || intersection1.y !== 0) {
                p1 = intersection1;
                p2 = intersection2;
                sPos = getPosition(sourceNode, p1);
                tPos = getPosition(targetNode, p2);
            }
        }
    }

    const [edgePath, labelX, labelY] = getSmoothStepPath({
        sourceX: p1.x,
        sourceY: p1.y,
        sourcePosition: sPos,
        targetX: p2.x,
        targetY: p2.y,
        targetPosition: tPos,
        borderRadius: 8,
    });

    return (
        <>
            <BaseEdge 
                path={edgePath} 
                style={{ ...style, strokeWidth: 1.5, stroke: 'var(--text-secondary)' }} 
                markerStart="url(#crows-foot-many)"
                markerEnd="url(#crows-foot-one)"
            />
            <EdgeLabelRenderer>
                <div
                    style={{
                        position: 'absolute',
                        transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
                        fontSize: 10,
                        backgroundColor: 'var(--bg-secondary)',
                        padding: '2px 6px',
                        borderRadius: 4,
                        pointerEvents: 'all',
                        color: 'var(--text-secondary)',
                        border: '1px solid var(--border-color)',
                        zIndex: 10,
                    }}
                    className="nodrag nopan"
                >
                    {edgeData?.label}
                </div>
            </EdgeLabelRenderer>
        </>
    );
};

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
            <Handle type="target" position={Position.Left} style={{ visibility: 'hidden' }} />
            
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

            <Handle type="source" position={Position.Right} style={{ visibility: 'hidden' }} />
        </div>
    );
};

const nodeTypes: NodeTypes = {
    tableNode: TableNode,
};

const edgeTypes: EdgeTypes = {
    erdEdge: ErdEdge,
};

interface ErdViewProps {
    schema: string;
    table: string;
    onCountChange?: (count: number) => void;
}

export const ErdView: React.FC<ErdViewProps> = ({ schema, table, onCountChange }) => {
    const { theme } = useSettingsStore();
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
                    const edgeData = {
                        label: `${r.SourceColumn} → ${r.TargetColumn}`,
                        sourceCardinality: '∞',
                        targetCardinality: '1🔑', // Key icon for PK
                    };

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
                            type: 'erdEdge',
                            source: table,
                            target: r.TargetTable,
                            data: edgeData,
                            style: { stroke: 'var(--text-secondary)' },
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
                            type: 'erdEdge',
                            source: r.SourceTable,
                            target: table,
                            data: edgeData,
                            style: { stroke: 'var(--text-secondary)' },
                        });
                    } else if (r.SourceTable === table && r.TargetTable === table) {
                        newEdges.push({
                            id: r.ConstraintName,
                            type: 'erdEdge',
                            source: table,
                            target: table,
                            data: edgeData,
                            style: { stroke: 'var(--text-secondary)' },
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
            <svg style={{ position: 'absolute', width: 0, height: 0 }}>
                <defs>
                    <marker id="crows-foot-many" viewBox="0 -10 20 20" refX="0" refY="0" markerWidth="15" markerHeight="15" orient="auto">
                        <path d="M 0,-6 L 10,0 M 0,6 L 10,0 M 0,0 L 10,0" stroke="var(--text-secondary)" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    </marker>
                    <marker id="crows-foot-one" viewBox="0 -10 20 20" refX="10" refY="0" markerWidth="15" markerHeight="15" orient="auto">
                        <path d="M 0,-6 L 0,6 M 5,-6 L 5,6" stroke="var(--text-secondary)" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                    </marker>
                </defs>
            </svg>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                fitView
                fitViewOptions={{ padding: 0.3 }}
                minZoom={0.1}
                maxZoom={2}
                colorMode={theme as 'light' | 'dark' | 'system'}
                proOptions={{ hideAttribution: true }}
            >
                <Background color="var(--border-color)" gap={20} size={1} />
            </ReactFlow>
        </div>
    );
};

