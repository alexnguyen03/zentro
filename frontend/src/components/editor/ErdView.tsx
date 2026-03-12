import React, { useEffect, useState, useCallback, useRef } from 'react';
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

    const padding = 12;
    const wp = w + padding;
    const hp = h + padding;

    let x = 0, y = 0;
    if (Math.abs(dx) * hp > Math.abs(dy) * wp) {
        x = x1 + (dx > 0 ? wp : -wp);
        y = y1 + dy * Math.abs(wp / dx);
    } else {
        y = y1 + (dy > 0 ? hp : -hp);
        x = x1 + dx * Math.abs(hp / dy);
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
                markerStart="url(#zentro-many)"
                markerEnd="url(#zentro-one)"
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ 
                                color: c.isPk ? 'var(--accent-color)' : (c.isFk ? '#3b82f6' : 'inherit'), 
                                fontWeight: (c.isPk || c.isFk) ? 600 : 'normal' 
                            }}>
                                {c.name}
                            </span>
                            {c.isPk && <span style={{ fontSize: 9, padding: '1px 3px', borderRadius: 3, background: 'var(--accent-color)', color: 'white' }}>PK</span>}
                            {c.isFk && <span style={{ fontSize: 9, padding: '1px 3px', borderRadius: 3, background: '#3b82f6', color: 'white' }}>FK</span>}
                        </div>
                        <span style={{ opacity: 0.6, fontSize: 11, marginLeft: 16 }}>{c.type}</span>
                    </div>
                ))}
                {(!data.columns || data.columns.length === 0) && (
                    <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                        No columns found
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

    const isMounted = useRef(true);
    const isFetching = useRef(false);

    useEffect(() => {
        isMounted.current = true;
        return () => { isMounted.current = false; };
    }, []);

    const loadErd = useCallback(async () => {
        if (isFetching.current) return;
        isFetching.current = true;

        try {
            if (isMounted.current) {
                setLoading(true);
                setError('');
            }

            // 1. Initial discovery: relationships of the main table
            const initialRels = await FetchTableRelationships(schema, table);
            if (!isMounted.current) return;

            const relatedTables = new Set<string>();
            relatedTables.add(table);
            if (initialRels) {
                initialRels.forEach((r: any) => {
                    relatedTables.add(r.SourceTable);
                    relatedTables.add(r.TargetTable);
                });
            }

            // 2. Fetch ALL relationships for ALL discovered tables to find cross-links between neighbors
            const allRelsMap = new Map<string, any>();
            if (initialRels) {
                initialRels.forEach(r => allRelsMap.set(r.ConstraintName, r));
            }

            // Also fetch neighboring relationships
            for (const t of Array.from(relatedTables)) {
                if (t === table || !isMounted.current) continue;

                let s = schema;
                const r: any = initialRels?.find((rel: any) => rel.SourceTable === t || rel.TargetTable === t);
                if (r) s = r.SourceTable === t ? r.SourceSchema : r.TargetSchema;

                try {
                    const neighborRels = await FetchTableRelationships(s, t);
                    if (!isMounted.current) return;
                    neighborRels?.forEach((nr: any) => {
                        if (relatedTables.has(nr.SourceTable) && relatedTables.has(nr.TargetTable)) {
                            allRelsMap.set(nr.ConstraintName, nr);
                        }
                    });
                } catch (e) {
                    console.warn(`Failed to fetch rels for ${t}`, e);
                }
            }

            const finalRels = Array.from(allRelsMap.values());
            console.log('ERD Discovery - Tables:', Array.from(relatedTables), 'Relationships:', finalRels);

            if (onCountChange && isMounted.current) {
                onCountChange(finalRels.length);
            }

            // 3. Fetch columns for all visible tables
            const columnsMap = new Map<string, any[]>();
            for (const t of Array.from(relatedTables)) {
                if (!isMounted.current) return;
                let s = schema;
                if (t !== table) {
                    const r: any = finalRels.find((rel: any) => rel.SourceTable === t || rel.TargetTable === t);
                    if (r) s = r.SourceTable === t ? r.SourceSchema : r.TargetSchema;
                }
                try {
                    const cols = await FetchTableColumns(s, t);
                    if (isMounted.current) {
                        // Mark FKs based on finalRels
                        const tableFks = new Set(
                            finalRels
                                .filter(r => r.SourceTable === t)
                                .map(r => r.SourceColumn)
                        );

                        columnsMap.set(t, (cols || []).map((c: any) => ({
                            name: c.Name,
                            type: c.DataType,
                            isPk: c.IsPrimaryKey,
                            isFk: tableFks.has(c.Name)
                        })));
                    }
                } catch (e) {
                    console.error(`Failed to fetch columns for ${t} in schema ${s}`, e);
                    columnsMap.set(t, []);
                }
            }

            if (!isMounted.current) return;

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

            const constraintGroups = new Map<string, any>();
            finalRels.forEach((r: any) => {
                if (!constraintGroups.has(r.ConstraintName)) {
                    constraintGroups.set(r.ConstraintName, {
                        ...r,
                        columns: [r.SourceColumn],
                        targets: [r.TargetColumn]
                    });
                } else {
                    const group = constraintGroups.get(r.ConstraintName);
                    group.columns.push(r.SourceColumn);
                    group.targets.push(r.TargetColumn);
                }
            });

            Array.from(constraintGroups.values()).forEach((r: any) => {
                const sourceTableId = r.SourceTable;
                const targetTableId = r.TargetTable;

                if (!addedNodeIds.has(sourceTableId)) {
                    newNodes.push({
                        id: sourceTableId,
                        type: 'tableNode',
                        position: { x: 50, y: parentY },
                        data: { label: sourceTableId, columns: columnsMap.get(sourceTableId) || [] },
                    });
                    addedNodeIds.add(sourceTableId);
                    parentY += 250;
                }
                if (!addedNodeIds.has(targetTableId)) {
                    newNodes.push({
                        id: targetTableId,
                        type: 'tableNode',
                        position: { x: 750, y: childY },
                        data: { label: targetTableId, columns: columnsMap.get(targetTableId) || [] },
                    });
                    addedNodeIds.add(targetTableId);
                    childY += 250;
                }

                newEdges.push({
                    id: r.ConstraintName,
                    type: 'erdEdge',
                    source: sourceTableId,
                    target: targetTableId,
                    data: {
                        label: `${r.columns.join(', ')} → ${r.targets.join(', ')}`,
                    },
                    style: { stroke: 'var(--text-secondary)' },
                });
            });

            setNodes(newNodes);
            setEdges(newEdges);
            setLoading(false);
        } catch (e: any) {
            if (isMounted.current) {
                setError(e.toString());
                setLoading(false);
            }
        } finally {
            isFetching.current = false;
        }
    }, [schema, table, setNodes, setEdges]); // Removed onCountChange from deps

    useEffect(() => {
        loadErd();
    }, [loadErd]);

    if (loading) {
        return (
            <div className="flex items-center justify-center gap-2 p-5 h-full" style={{ background: 'var(--bg-main)' }}>
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
                edgeTypes={edgeTypes}
                fitView
                fitViewOptions={{ padding: 0.3 }}
                minZoom={0.1}
                maxZoom={2}
                colorMode={theme as 'light' | 'dark' | 'system'}
                proOptions={{ hideAttribution: true }}
            >
                <svg style={{ position: 'absolute', width: 0, height: 0 }}>
                    <defs>
                        <marker
                            id="zentro-many"
                            viewBox="0 -10 20 20"
                            refX="0"
                            refY="0"
                            markerWidth="12"
                            markerHeight="12"
                            orient="auto-start-reverse"
                        >
                            <path
                                d="M 15,-8 L 1,0 L 15,8 M 15,0 L 1,0"
                                stroke="var(--text-secondary)"
                                strokeWidth="1.5"
                                fill="none"
                            />
                        </marker>
                        <marker
                            id="zentro-one"
                            viewBox="0 -10 20 20"
                            refX="0"
                            refY="0"
                            markerWidth="12"
                            markerHeight="12"
                            orient="auto"
                        >
                            <path
                                d="M 0,0 L 12,0 M 6,-8 L 6,8"
                                stroke="var(--text-secondary)"
                                strokeWidth="1.5"
                                fill="none"
                            />
                        </marker>
                    </defs>
                </svg>
                <Background color="var(--border-color)" gap={20} size={1} />
            </ReactFlow>
        </div>
    );
};
