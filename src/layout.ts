// Дерево навігації → ноди та ребра React Flow (ADR-0009).
import type { EntityFlowNode } from './EntityNode';
import type { GraphFlowEdge } from './GraphEdge';
import { registry } from './entities/registry';
import type { NavState } from './navigation';

/** ADR-0012: скільки кроків від фокуса лишаються розгорнутими — назад (предки) і вперед (нащадки). */
export const EXPAND_BACK = 1;
export const EXPAND_FORWARD = 3;
/** Камера показує лише найближчих сусідів, щоб картки лишались читабельними. */
export const CAMERA_RADIUS = 1;

/**
 * Правило згортання (ADR-0012, узагальнює ADR-0009 і ADR-0003): розгорнуті фокус,
 * `back` предків, нащадки фокуса до глибини `forward` і сестри фокуса. Решта — іконки.
 */
export function expandedKeys(state: NavState, back = EXPAND_BACK, forward = EXPAND_FORWARD): Set<string> {
  const focus = state.nodes[state.focus];
  const keys = new Set([focus.key]);

  let up = focus.parent;
  for (let i = 0; i < back && up; i++, up = state.nodes[up].parent) keys.add(up);

  const down = (key: string, depth: number) => {
    if (depth > forward) return;
    keys.add(key);
    state.nodes[key].children.forEach((c) => down(c, depth + 1));
  };
  focus.children.forEach((c) => down(c, 1));

  if (focus.parent && back > 0) state.nodes[focus.parent].children.forEach((k) => keys.add(k));
  return keys;
}

export const COLLAPSED = 72;
export const GAP = 90;
export const GAP_Y = 40;
/** Оцінки висоти, поки нода не виміряна. */
export const ESTIMATE = { expanded: 420, collapsed: 78 };

/** Виміряні висоти нод: ключ `${key}:e` або `${key}:c` (розгорнута/згорнута). */
export type Heights = Record<string, number>;
export const heightKey = (key: string, expanded: boolean) => `${key}:${expanded ? 'e' : 'c'}`;

export function buildGraph(state: NavState, heights: Heights = {}) {
  const expanded = expandedKeys(state);
  const nodes: EntityFlowNode[] = [];
  const edges: GraphFlowEdge[] = [];
  let complete = true;

  const depth: Record<string, number> = {};
  const colWidth: number[] = [];
  const height = (key: string) => {
    const h = heights[heightKey(key, expanded.has(key))];
    if (h === undefined) complete = false;
    return h ?? (expanded.has(key) ? ESTIMATE.expanded : ESTIMATE.collapsed);
  };

  // 1. Глибини й ширини колонок.
  const walk = (key: string, d: number) => {
    depth[key] = d;
    const n = state.nodes[key];
    const w = expanded.has(key) ? registry[n.ref.type].width : COLLAPSED;
    colWidth[d] = Math.max(colWidth[d] ?? 0, w);
    n.children.forEach((c) => walk(c, d + 1));
  };
  walk(state.root, 0);
  const colX: number[] = [0];
  for (let d = 1; d < colWidth.length; d++) colX[d] = colX[d - 1] + colWidth[d - 1] + GAP;

  // 2. «Охайне дерево» з вирівнюванням по верху: повертає висоту піддерева.
  const place = (key: string, y: number): number => {
    const n = state.nodes[key];
    const isExpanded = expanded.has(key);
    nodes.push({
      id: key,
      type: 'entity',
      position: { x: colX[depth[key]], y },
      data: { entity: n.ref, nodeKey: key, isRoot: n.parent === null, expanded: isExpanded, focused: key === state.focus },
      draggable: false,
      selectable: false,
      // Не-draggable і не-selectable ноди React Flow робить `pointer-events: none` — повертаємо кліки.
      style: { pointerEvents: 'all' },
    });

    let childY = y;
    n.children.forEach((c, i) => {
      if (i > 0) childY += GAP_Y;
      edges.push({
        id: `${key}->${c}`,
        source: key,
        target: c,
        type: 'graph',
        label: state.nodes[c].via,
        data: { active: c === state.focus },
      });
      childY += place(c, childY);
    });
    return Math.max(height(key), childY - y);
  };
  place(state.root, 0);

  return { nodes, edges, expanded, camera: expandedKeys(state, CAMERA_RADIUS, CAMERA_RADIUS), complete };
}
