// Конектор з макета Figma 638:4192 (ADR-0008 §2): крива з півкруглим «язичком» біля джерела.
import { BaseEdge, EdgeLabelRenderer, getBezierPath, type Edge, type EdgeProps, type InternalNode } from '@xyflow/react';
import type { Anchor, Dir, Route } from './edgeGeometry';

export type GraphEdgeData = {
  active: boolean;
  /** Id якоря на елементі-джерелі (рядку, плитці), з якого відкрили ціль (ADR-0015). */
  anchor?: string;
  /** «Мапа»: маршрут ребра, порахований лейаутом (ADR-0017). */
  route?: Route;
  /** «Мапа»: з якого боку батька стоїть ціль. */
  dir?: Dir;
  /** «Мапа»: чи відомий якір — ребро стартує від рядка, а не від середини боку. */
  anchored?: boolean;
};

export type GraphFlowEdge = Edge<GraphEdgeData, 'graph' | 'map'>;

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

/** Якір рядка з двох хендлів `LinkAnchor` (лівий і правий край рядка), відносно картки. */
export function anchorOf(n: InternalNode, id: string): Anchor | null {
  const hs = n.internals.handleBounds?.source;
  const l = hs?.find((h) => h.id === `${id}:l`);
  const r = hs?.find((h) => h.id === `${id}:r`);
  if (!l || !r) return null;
  return { x0: l.x, x1: r.x + r.width, y: l.y + l.height / 2 };
}

const ARROW = 7;

/** ADR-0017: ребро «Мапи» малює маршрут, порахований лейаутом, — від рядка, на який клікнули, до цілі. */
export function MapEdge({ id, data, label }: EdgeProps<GraphFlowEdge>) {
  const route = data?.route;
  if (!route) return null;
  const color = data.active ? ACTIVE : IDLE;
  const shadow = { filter: 'drop-shadow(0 0 4px rgb(0 0 0 / .35))' };
  const { start: a, end: b, out, into, mid } = route;
  // «Язичок» біля джерела — як у дереві, але розвернутий у бік виходу ребра.
  const tab = `M${a.x - out.y * TAB_R},${a.y + out.x * TAB_R} A${TAB_R},${TAB_R} 0 0 0 ${a.x + out.y * TAB_R},${a.y - out.x * TAB_R} Z`;
  // Стрілка: вістря на межі цілі, основа — назовні вздовж нормалі.
  const base = { x: b.x + into.x * ARROW * 1.4, y: b.y + into.y * ARROW * 1.4 };
  const arrow = `M${b.x},${b.y} L${base.x - into.y * ARROW},${base.y + into.x * ARROW} L${base.x + into.y * ARROW},${base.y - into.x * ARROW} Z`;

  return (
    <>
      <BaseEdge id={id} path={route.path} style={{ stroke: color, strokeWidth: 1, ...shadow }} />
      <path d={tab} fill={color} style={shadow} data-anchored={data.anchored ? 'row' : 'border'} />
      <path d={arrow} fill={color} className="graph-edge__arrow" />
      {label && (
        <EdgeLabelRenderer>
          <div className="graph-edge__label" style={{ transform: `translate(-50%, -110%) translate(${mid.x}px, ${mid.y}px)` }}>
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
