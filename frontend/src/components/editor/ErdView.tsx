import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
    ReactFlow,
    Background,
    useNodesState,
    useEdgesState,
    type Node,
    type Edge,
    type NodeTypes,
    type EdgeTypes,
    Handle,
    Position,
    BaseEdge,
    EdgeLabelRenderer,
    getSmoothStepPath,
    type EdgeProps,
    useStore,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { FetchTableRelationships, FetchTableColumns } from '../../services/schemaService';
import { Loader } from 'lucide-react';
import { useSettingsStore } from '../../stores/settingsStore';
import { models } from '../../../wailsjs/go/models';
import { getErrorMessage } from '../../lib/errors';

interface ErdEdgeData extends Record<string, unknown> {
    label?: string;
}

interface ErdColumn {
    name: string;
    type: string;
    isPk: boolean;
    isFk: boolean;
}

interface TableNodeData extends Record<string, unknown> {
    label: string;
    columns: ErdColumn[];
}

interface MeasuredNodeLike {
    measured?: { width?: number; height?: number };
    internals?: { positionAbsolute?: { x: number; y: number } };
    positionAbsolute?: { x: number; y: number };
    position?: { x: number; y: number };
}

interface NodeLookupState {
    nodeLookup?: Map<string, MeasuredNodeLike>;
    nodeInternals?: Map<string, MeasuredNodeLike>;
}

interface ConstraintGroup extends models.TableRelationship {
    columns: string[];
    targets: string[];
}

function getNodeCenter(node: MeasuredNodeLike) {
    const width = node.measured?.width ?? 0;
    const height = node.measured?.height ?? 0;
    const x = node.internals?.positionAbsolute?.x ?? node.positionAbsolute?.x ?? node.position?.x ?? 0;
    const y = node.internals?.positionAbsolute?.y ?? node.positionAbsolute?.y ?? node.position?.y ?? 0;
    return { x: x + width / 2, y: y + height / 2, width, height };
}

function getIntersection(n1: MeasuredNodeLike | undefined, n2: MeasuredNodeLike | undefined) {
    if (!n1 || !n2 || !n1.measured?.width || !n1.measured?.height || !n2.measured?.width || !n2.measured?.height) {
        return { x: 0, y: 0 };
    }

    const p1 = getNodeCenter(n1);
    const p2 = getNodeCenter(n2);
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;

    if (dx === 0 && dy === 0) return { x: p1.x, y: p1.y };

    const padding = 12;
    const wp = p1.width / 2 + padding;
    const hp = p1.height / 2 + padding;

    if (Math.abs(dx) * hp > Math.abs(dy) * wp) {
        return {
            x: p1.x + (dx > 0 ? wp : -wp),
            y: p1.y + dy * Math.abs(wp / dx),
        };
    }

    return {
        y: p1.y + (dy > 0 ? hp : -hp),
        x: p1.x + dx * Math.abs(hp / dy),
    };
}

function getPosition(node: MeasuredNodeLike | undefined, point: { x: number; y: number }) {
    if (!node || !node.measured?.width || !node.measured?.height) return Position.Left;
    const center = getNodeCenter(node);
    const dx = point.x - center.x;
    const dy = point.y - center.y;
    if (Math.abs(dx) > Math.abs(dy)) {
        return dx > 0 ? Position.Right : Position.Left;
    }
    return dy > 0 ? Position.Bottom : Position.Top;
}

const ErdEdge: React.FC<EdgeProps> = ({
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
}) => {
    const edgeData = data as ErdEdgeData;
    const sourceNode = useStore((store) => {
        const nodeStore = store as NodeLookupState;
        return nodeStore.nodeLookup?.get(source) ?? nodeStore.nodeInternals?.get(source);
    });
    const targetNode = useStore((store) => {
        const nodeStore = store as NodeLookupState;
        return nodeStore.nodeLookup?.get(target) ?? nodeStore.nodeInternals?.get(target);
    });

    let p1 = { x: sourceX, y: sourceY };
    let p2 = { x: targetX, y: targetY };
    let sPos = sourcePosition;
    let tPos = targetPosition;

    if (sourceNode && targetNode) {
        if (source === target) {
            const width = sourceNode.measured?.width ?? 200;
            const height = sourceNode.measured?.height ?? 100;
            const px = sourceNode.internals?.positionAbsolute?.x ?? sourceNode.positionAbsolute?.x ?? sourceNode.position?.x ?? 0;
            const py = sourceNode.internals?.positionAbsolute?.y ?? sourceNode.positionAbsolute?.y ?? sourceNode.position?.y ?? 0;
            p1 = { x: px + width, y: py + 40 };
            sPos = Position.Right;
            p2 = { x: px + 40, y: py + height };
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
                style={{ ...style, strokeWidth: 1.5, stroke: 'var(--content-secondary)' }}
                markerStart="url(#zentro-many)"
                markerEnd="url(#zentro-one)"
            />
            <EdgeLabelRenderer>
                <div
                    style={{
                        position: 'absolute',
                        transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
                        fontSize: 10,
                        backgroundColor: 'var(--surface-panel)',
                        padding: '2px 6px',
                        borderRadius: 4,
                        pointerEvents: 'all',
                        color: 'var(--content-secondary)',
                        border: '1px solid var(--border-default)',
                        zIndex: 'var(--layer-sticky)',
                    }}
                    className="nodrag nopan"
                >
                    {edgeData?.label}
                </div>
            </EdgeLabelRenderer>
        </>
    );
};

const TableNode: React.FC<{ data: TableNodeData }> = ({ data }) => {
    return (
        <div style={{
            background: 'var(--surface-panel)',
            border: '1px solid var(--border-default)',
            borderRadius: 6,
            minWidth: 200,
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            overflow: 'hidden'
        }}>
            <Handle type="target" position={Position.Left} style={{ visibility: 'hidden' }} />

            <div style={{
                background: 'var(--surface-elevated)',
                padding: '8px 12px',
                borderBottom: '1px solid var(--border-default)',
                fontWeight: 600,
                fontSize: 13,
                color: 'var(--content-primary)'
            }}>
                {data.label}
            </div>

            <div style={{ padding: '4px 0' }}>
                {data.columns?.map((column, index) => (
                    <div key={`${column.name}-${index}`} style={{
                        padding: '4px 12px',
                        fontSize: 12,
                        display: 'flex',
                        justifyContent: 'space-between',
                        color: 'var(--content-secondary)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{
                                color: column.isPk ? 'var(--interactive-primary)' : (column.isFk ? '#3b82f6' : 'inherit'),
                                fontWeight: (column.isPk || column.isFk) ? 600 : 'normal'
                            }}>
                                {column.name}
                            </span>
                            {column.isPk && <span style={{ fontSize: 9, padding: '1px 3px', borderRadius: 3, background: 'var(--interactive-primary)', color: 'white' }}>PK</span>}
                            {column.isFk && <span style={{ fontSize: 9, padding: '1px 3px', borderRadius: 3, background: '#3b82f6', color: 'white' }}>FK</span>}
                        </div>
                        <span style={{ opacity: 0.6, fontSize: 11, marginLeft: 16 }}>{column.type}</span>
                    </div>
                ))}
                {(!data.columns || data.columns.length === 0) && (
                    <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--content-secondary)', fontStyle: 'italic' }}>
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

            const initialRels = await FetchTableRelationships(schema, table);
            if (!isMounted.current) return;

            const relatedTables = new Set<string>([table]);
            (initialRels || []).forEach((relation) => {
                relatedTables.add(relation.SourceTable);
                relatedTables.add(relation.TargetTable);
            });

            const allRelsMap = new Map<string, models.TableRelationship>();
            (initialRels || []).forEach((relation) => allRelsMap.set(relation.ConstraintName, relation));

            for (const currentTable of Array.from(relatedTables)) {
                if (currentTable === table || !isMounted.current) continue;

                let relationSchema = schema;
                const relationOfTable = initialRels?.find((relation) =>
                    relation.SourceTable === currentTable || relation.TargetTable === currentTable
                );
                if (relationOfTable) {
                    relationSchema = relationOfTable.SourceTable === currentTable
                        ? relationOfTable.SourceSchema
                        : relationOfTable.TargetSchema;
                }

                try {
                    const neighborRels = await FetchTableRelationships(relationSchema, currentTable);
                    if (!isMounted.current) return;
                    (neighborRels || []).forEach((neighborRelation) => {
                        if (relatedTables.has(neighborRelation.SourceTable) && relatedTables.has(neighborRelation.TargetTable)) {
                            allRelsMap.set(neighborRelation.ConstraintName, neighborRelation);
                        }
                    });
                } catch (error) {
                    console.warn(`Failed to fetch rels for ${currentTable}`, error);
                }
            }

            const finalRels = Array.from(allRelsMap.values());
            if (onCountChange && isMounted.current) {
                onCountChange(finalRels.length);
            }

            const columnsMap = new Map<string, ErdColumn[]>();
            for (const currentTable of Array.from(relatedTables)) {
                if (!isMounted.current) return;

                let relationSchema = schema;
                if (currentTable !== table) {
                    const relationOfTable = finalRels.find((relation) =>
                        relation.SourceTable === currentTable || relation.TargetTable === currentTable
                    );
                    if (relationOfTable) {
                        relationSchema = relationOfTable.SourceTable === currentTable
                            ? relationOfTable.SourceSchema
                            : relationOfTable.TargetSchema;
                    }
                }

                try {
                    const cols = await FetchTableColumns(relationSchema, currentTable);
                    if (!isMounted.current) return;

                    const tableFks = new Set(
                        finalRels
                            .filter((relation) => relation.SourceTable === currentTable)
                            .map((relation) => relation.SourceColumn)
                    );

                    columnsMap.set(currentTable, (cols || []).map((column) => ({
                        name: column.Name,
                        type: column.DataType,
                        isPk: column.IsPrimaryKey,
                        isFk: tableFks.has(column.Name),
                    })));
                } catch (error) {
                    console.error(`Failed to fetch columns for ${currentTable} in schema ${relationSchema}`, error);
                    columnsMap.set(currentTable, []);
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

            const constraintGroups = new Map<string, ConstraintGroup>();
            finalRels.forEach((relation) => {
                const existing = constraintGroups.get(relation.ConstraintName);
                if (!existing) {
                    constraintGroups.set(relation.ConstraintName, {
                        ...relation,
                        columns: [relation.SourceColumn],
                        targets: [relation.TargetColumn],
                    });
                    return;
                }
                existing.columns.push(relation.SourceColumn);
                existing.targets.push(relation.TargetColumn);
            });

            Array.from(constraintGroups.values()).forEach((relation) => {
                const sourceTableId = relation.SourceTable;
                const targetTableId = relation.TargetTable;

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
                    id: relation.ConstraintName,
                    type: 'erdEdge',
                    source: sourceTableId,
                    target: targetTableId,
                    data: {
                        label: `${relation.columns.join(', ')} -> ${relation.targets.join(', ')}`,
                    },
                    style: { stroke: 'var(--content-secondary)' },
                });
            });

            setNodes(newNodes);
            setEdges(newEdges);
            setLoading(false);
        } catch (error: unknown) {
            if (isMounted.current) {
                setError(getErrorMessage(error));
                setLoading(false);
            }
        } finally {
            isFetching.current = false;
        }
    }, [schema, table, setNodes, setEdges, onCountChange]);

    useEffect(() => {
        void loadErd();
    }, [loadErd]);

    if (loading) {
        return (
            <div className="flex items-center justify-center gap-2 p-5 h-full" style={{ background: 'var(--surface-app)' }}>
                <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> Loading ERD...
            </div>
        );
    }

    if (error) {
        return <div className="p-5 h-full" style={{ color: 'var(--status-error)', background: 'var(--surface-app)' }}>{error}</div>;
    }

    return (
        <div className="flex-1 w-full h-full min-h-0 relative" style={{ background: 'var(--surface-app)' }}>
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
                                stroke="var(--content-secondary)"
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
                                stroke="var(--content-secondary)"
                                strokeWidth="1.5"
                                fill="none"
                            />
                        </marker>
                    </defs>
                </svg>
                <Background color="var(--border-default)" gap={20} size={1} />
            </ReactFlow>
        </div>
    );
};
