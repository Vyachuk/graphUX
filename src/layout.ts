// Дерево навігації → ноди та ребра React Flow (ADR-0009).
import type { EntityFlowNode } from './EntityNode';
import type { GraphFlowEdge } from './GraphEdge';
import { registry } from './entities/registry';
import type { NavState } from './navigation';

/** ADR-0012: скільки карток на шляху навколо фокуса завжди розгорнуто (разом із фокусом). */
export const FOCUS_WINDOW = 4;
/** Мінімум кроків назад у вікні (якщо є куди). */
export const MIN_BACK = 1;
/** Скільки кроків уперед вікно бере в першу чергу, решту добирає назад. */
export const PREFER_FORWARD = 2;

/** Шлях уперед від фокуса: щоразу остання відкрита гілка (так само, як клавіша →). */
function forwardChain(state: NavState, key: string): string[] {
  const chain: string[] = [];
  for (let k = state.nodes[key].children.at(-1); k; k = state.nodes[k].children.at(-1)) chain.push(k);
  return chain;
}

/** Предки фокуса від найближчого. */
function ancestors(state: NavState, key: string): string[] {
  const up: string[] = [];
  for (let k = state.nodes[key].parent; k; k = state.nodes[k].parent) up.push(k);
  return up;
}

/**
 * Правило згортання (ADR-0012): вікно з FOCUS_WINDOW карток на шляху навколо фокуса —
 * мінімум MIN_BACK назад, до PREFER_FORWARD уперед, решту добираємо з того боку, де є куди.
 * Додатково розгорнуті сестри й діти фокуса (гілки з ADR-0009). Решта — іконки.
 */
export function expandedKeys(state: NavState, window = FOCUS_WINDOW): Set<string> {
  const focus = state.nodes[state.focus];
  const up = ancestors(state, focus.key);
  const down = forwardChain(state, focus.key);
  const slots = window - 1;

  let back = Math.min(up.length, MIN_BACK, slots);
  let fwd = Math.min(down.length, PREFER_FORWARD, slots - back);
  back = Math.min(up.length, slots - fwd);
  fwd = Math.min(down.length, slots - back);

  const keys = new Set([focus.key, ...up.slice(0, back), ...down.slice(0, fwd), ...focus.children]);
  if (focus.parent) state.nodes[focus.parent].children.forEach((k) => keys.add(k));
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

  return { nodes, edges, expanded, camera: new Set([state.focus]), complete };
}
