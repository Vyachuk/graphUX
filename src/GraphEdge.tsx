// Конектор з макета Figma 638:4192 (ADR-0008 §2): крива з півкруглим «язичком» біля джерела.
import { BaseEdge, EdgeLabelRenderer, getBezierPath, type Edge, type EdgeProps } from '@xyflow/react';

export type GraphEdgeData = { active: boolean };
export type GraphFlowEdge = Edge<GraphEdgeData, 'graph'>;

const ACTIVE = '#34D399';
const IDLE = '#5B5F5D';
const TAB_R = 7;

export function GraphEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, label }: EdgeProps<GraphFlowEdge>) {
  const color = data?.active ? ACTIVE : IDLE;
  const [path, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });

  return (
    <>
      <BaseEdge id={id} path={path} style={{ stroke: color, strokeWidth: 1, filter: 'drop-shadow(0 0 4px rgb(0 0 0 / .35))' }} />
      {/* Півкруг, що «виростає» з правого краю ноди-джерела. */}
      <path
        d={`M${sourceX},${sourceY - TAB_R} A${TAB_R},${TAB_R} 0 0 1 ${sourceX},${sourceY + TAB_R} Z`}
        fill={color}
        style={{ filter: 'drop-shadow(0 0 4px rgb(0 0 0 / .35))' }}
      />
      {label && (
        <EdgeLabelRenderer>
          <div className="graph-edge__label" style={{ transform: `translate(-50%, -100%) translate(${labelX}px, ${labelY - 4}px)` }}>
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
