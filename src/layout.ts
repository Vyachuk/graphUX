// Дерево навігації → ноди та ребра React Flow (ADR-0009).
import type { EntityFlowNode } from './EntityNode';
import type { GraphFlowEdge } from './GraphEdge';
import { registry } from './entities/registry';
import { clickDir, HEADER_Y, opposite, sideRoute, verticalRoute, type Anchor, type Dir, type Route } from './edgeGeometry';
import { anchorId, type NavState } from './navigation';
import { cardWidth } from './stress';

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
  // ADR-0013: у стрес-тесті розгорнуто все.
  if (state.stress) return new Set(Object.keys(state.nodes));
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

/**
 * 'map' — «Мапа» (ADR-0016, ADR-0017): нова картка стоїть з того боку батька, де клікнули; ребра в порожніх каналах.
 * 'tree' — колонки за глибиною, діти під батьком (ADR-0009).
 */
export type LayoutMode = 'map' | 'tree';

type Size = { w: number; h: number };
type Point = { x: number; y: number };

/** Виміряні якорі ребер (ADR-0016): ключ — нода-ціль, значення — рядок у картці батька, з якого її відкрили. */
export type Anchors = Record<string, Anchor>;

/** z-index ребер «Мапи»: над картками (стрілки й «язички» завжди видно; карток ребра не перетинають). */
export const EDGE_Z = 1000;

export function buildGraph(state: NavState, heights: Heights = {}, mode: LayoutMode = 'tree', anchors: Anchors = {}) {
  const expanded = expandedKeys(state);
  const nodes: EntityFlowNode[] = [];
  const edges: GraphFlowEdge[] = [];
  let complete = true;

  const size = (key: string): Size => {
    const isExpanded = expanded.has(key);
    const h = heights[heightKey(key, isExpanded)];
    if (h === undefined) complete = false;
    return {
      w: isExpanded ? cardWidth(registry[state.nodes[key].ref.type], key, state.stress) : COLLAPSED,
      h: h ?? (isExpanded ? ESTIMATE.expanded : ESTIMATE.collapsed),
    };
  };

  // Якір має сенс лише для розгорнутого батька: в іконці рядків немає (ребро йде від її боку).
  const live: Anchors = {};
  if (mode === 'map') {
    for (const n of Object.values(state.nodes)) {
      if (!n.parent || !expanded.has(n.parent)) continue;
      // Картку-відповідь відкриває асистент, а не рядок (ADR-0018): якоря немає, стоїть праворуч.
      if (n.ref.type === 'assistant') continue;
      if (anchors[n.key]) live[n.key] = anchors[n.key];
      // Поки рядки не виміряні, лейаут не знає, куди ставити картки, — камера чекає на них.
      else complete = false;
    }
  }
  const map = mode === 'map' ? mapLayout(state, size, live) : null;
  const position = map?.pos ?? treeLayout(state, size);

  // Ноди й ребра — у порядку обходу в глибину, однаково для обох лейаутів.
  const emit = (key: string) => {
    const n = state.nodes[key];
    nodes.push({
      id: key,
      type: 'entity',
      position: position[key],
      data: {
        entity: n.ref,
        nodeKey: key,
        isRoot: n.parent === null,
        expanded: expanded.has(key),
        focused: key === state.focus,
        width: cardWidth(registry[n.ref.type], key, state.stress),
      },
      draggable: false,
      selectable: false,
      // Не-draggable і не-selectable ноди React Flow робить `pointer-events: none` — повертаємо кліки.
      style: { pointerEvents: 'all' },
    });
    for (const c of n.children) {
      edges.push({
        id: `${key}->${c}`,
        source: key,
        target: c,
        type: map ? 'map' : 'graph',
        label: state.nodes[c].via,
        ...(map && { zIndex: EDGE_Z }),
        data: {
          active: c === state.focus,
          anchor: anchorId(state.nodes[c].ref, state.nodes[c].via),
          ...(map && { route: map.routes[c], dir: map.dir[c], anchored: !!live[c] }),
        },
      });
      emit(c);
    }
  };
  emit(state.root);

  return { nodes, edges, expanded, camera: new Set([state.focus]), complete };
}

/** ADR-0009: x — колонки за глибиною, y — «охайне дерево» з вирівнюванням по верху. */
function treeLayout(state: NavState, size: (key: string) => Size): Record<string, Point> {
  const pos: Record<string, Point> = {};
  const depth: Record<string, number> = {};
  const colWidth: number[] = [];

  const walk = (key: string, d: number) => {
    depth[key] = d;
    colWidth[d] = Math.max(colWidth[d] ?? 0, size(key).w);
    state.nodes[key].children.forEach((c) => walk(c, d + 1));
  };
  walk(state.root, 0);
  const colX: number[] = [0];
  for (let d = 1; d < colWidth.length; d++) colX[d] = colX[d - 1] + colWidth[d - 1] + GAP;

  // Повертає висоту піддерева.
  const place = (key: string, y: number): number => {
    pos[key] = { x: colX[depth[key]], y };
    let childY = y;
    state.nodes[key].children.forEach((c, i) => {
      if (i > 0) childY += GAP_Y;
      childY += place(c, childY);
    });
    return Math.max(size(key).h, childY - y);
  };
  place(state.root, 0);
  return pos;
}

/** «Мапа»: ширина порожнього каналу між карткою та колонкою її дітей праворуч/ліворуч, px. */
export const CHANNEL = 120;
/** «Мапа»: мінімальна висота порожнього проміжку між карткою (з її бічними колонками) і рядом дітей зверху/знизу. */
export const CHANNEL_V = 100;
/** «Мапа»: відстань між горизонтальними доріжками вертикальних ребер у проміжку, px. */
export const LANE = 14;
/** «Мапа»: зазор між сусідніми піддеревами в колонці чи ряду, px. */
export const STACK_GAP = 32;
/** «Мапа»: півширина коридору, яким ребро від батька заходить у картку крізь її власних дітей, px. */
export const CORRIDOR = 24;

/** Смуга піддерева відносно лівого верхнього кута картки. */
type Band = { left: number; top: number; right: number; bottom: number };

/**
 * ADR-0017, «Мапа». Нова картка стоїть з того боку батька, до якого ближчий клікнутий рядок (clickDir):
 * праворуч (у пріоритеті), ліворуч, згори чи знизу.
 *  - Праворуч/ліворуч: колонка дітей за порожнім каналом CHANNEL; заголовок дитини — на висоті рядка.
 *  - Згори/знизу: ряд дітей вище/нижче за все, що стоїть обабіч картки, через проміжок з доріжками;
 *    дитина — навпроти клікнутого елемента.
 * Якщо місця не вистачає, сусідні піддерева розсуваються, а весь ряд/колонка зсувається назад на половину зсуву.
 *
 * Гарантії за побудовою: кожне піддерево займає свою смугу (Band), смуги сусідів не перетинаються, а ребро йде
 * лише порожнім каналом/проміжком свого батька і коридором у смузі дитини — тож не проходить під жодною карткою.
 * Коридор: діти, що стоять з боку, звідки в картку заходить ребро від її батька, відступають від нього.
 */
function mapLayout(state: NavState, size: (key: string) => Size, anchors: Anchors) {
  const dir: Record<string, Dir> = {};
  for (const n of Object.values(state.nodes)) {
    if (!n.parent) continue;
    const p = size(n.parent);
    dir[n.key] = clickDir(anchors[n.key], p.w, p.h);
  }
  const clampY = (y: number, h: number) => Math.min(h - 8, Math.max(8, y));
  const clampX = (x: number, w: number) => Math.min(w - 8, Math.max(8, x));

  const off: Record<string, Point> = {}; // лівий верхній кут дитини відносно батька
  const band: Record<string, Band> = {};
  const lane: Record<string, number> = {}; // y доріжки вертикального ребра відносно батька

  const measure = (key: string) => {
    const kids = state.nodes[key].children;
    kids.forEach(measure);
    const { w, h } = size(key);
    const inward = key === state.root ? null : opposite[dir[key]];
    const box: Band = { left: 0, top: 0, right: w, bottom: h };
    const grow = (c: string) => {
      const b = band[c];
      box.left = Math.min(box.left, off[c].x + b.left);
      box.top = Math.min(box.top, off[c].y + b.top);
      box.right = Math.max(box.right, off[c].x + b.right);
      box.bottom = Math.max(box.bottom, off[c].y + b.bottom);
    };

    /**
     * Розставляє смуги вздовж осі: ideal — бажаний початок смуги; min — нижня межа (коридор).
     * Повертає початки смуг; зсув назад на половину накопиченого зсуву, але не за межу min.
     */
    const stack = (items: { ideal: number; len: number }[], min = -Infinity) => {
      const at: number[] = [];
      let cursor = min;
      for (const it of items) {
        at.push(Math.max(it.ideal, cursor));
        cursor = at[at.length - 1] + it.len + STACK_GAP;
      }
      if (!items.length) return at;
      const last = items.length - 1;
      const back = Math.min((at[last] - items[last].ideal) / 2, Math.min(...at.map((a) => a - min)));
      return at.map((a) => a - Math.max(0, back));
    };

    // 1. Бічні колонки: смуги дітей по вертикалі, заголовок — на висоті рядка.
    for (const s of ['r', 'l'] as const) {
      const group = kids
        .filter((c) => dir[c] === s)
        .map((c) => ({ c, ideal: (anchors[c] ? clampY(anchors[c].y, h) : 0) - HEADER_Y + band[c].top }))
        .sort((a, b) => a.ideal - b.ideal);
      // Коридор: ребро від батька заходить у цю картку збоку на висоті заголовка — діти з того боку нижче.
      const min = s === inward ? HEADER_Y + CORRIDOR : -Infinity;
      const tops = stack(group.map((g) => ({ ideal: g.ideal, len: band[g.c].bottom - band[g.c].top })), min);
      group.forEach(({ c }, i) => {
        const b = band[c];
        off[c] = { x: s === 'r' ? w + CHANNEL - b.left : -CHANNEL - b.right, y: tops[i] - b.top };
        grow(c);
      });
    }
    const sideTop = box.top;
    const sideBottom = box.bottom;

    // 2. Ряди згори/знизу: вище/нижче за все, що обабіч; дитина — навпроти клікнутого елемента.
    for (const s of ['u', 'd'] as const) {
      const group = kids
        .filter((c) => dir[c] === s)
        .map((c) => {
          const cx = anchors[c] ? clampX((anchors[c].x0 + anchors[c].x1) / 2, w) : w / 2;
          return { c, cx, ideal: cx - size(c).w / 2 + band[c].left };
        })
        .sort((a, b) => a.cx - b.cx);
      if (!group.length) continue;
      const gap = Math.max(CHANNEL_V, LANE * (group.length + 1));
      const place = (part: typeof group, lefts: number[]) =>
        part.forEach(({ c }, i) => {
          const b = band[c];
          off[c] = { x: lefts[i] - b.left, y: s === 'u' ? sideTop - gap - b.bottom : sideBottom + gap - b.top };
          grow(c);
        });
      const len = (c: string) => band[c].right - band[c].left;
      if (s === inward) {
        // Коридор по центру картки: ребро від батька заходить згори/знизу посередині — діти обабіч нього.
        const mid = w / 2;
        const right = group.filter((g) => g.cx >= mid);
        const left = group.filter((g) => g.cx < mid).reverse();
        place(right, stack(right.map((g) => ({ ideal: g.ideal, len: len(g.c) })), mid + CORRIDOR));
        // Ліву частину розставляємо дзеркально: від коридору вліво.
        const mirrored = stack(left.map((g) => ({ ideal: -(g.ideal + len(g.c)), len: len(g.c) })), -(mid - CORRIDOR));
        place(left, mirrored.map((m, i) => -m - len(left[i].c)));
      } else {
        place(group, stack(group.map((g) => ({ ideal: g.ideal, len: len(g.c) }))));
      }
      // Доріжки: кожне ребро на своїй висоті в проміжку, щоб горизонтальні відрізки не зливались.
      group.forEach(({ c }, i) => {
        const step = gap / (group.length + 1);
        lane[c] = s === 'u' ? sideTop - step * (i + 1) : sideBottom + step * (i + 1);
      });
    }
    band[key] = box;
  };
  measure(state.root);

  // Згори вниз: абсолютні позиції й маршрути ребер.
  const pos: Record<string, Point> = {};
  const routes: Record<string, Route> = {};
  const place = (key: string, x: number, y: number) => {
    pos[key] = { x, y };
    const { w, h } = size(key);
    for (const c of state.nodes[key].children) {
      const cx = x + off[c].x;
      const cy = y + off[c].y;
      const cs = size(c);
      const a = anchors[c];
      const d = dir[c];
      if (d === 'r' || d === 'l') {
        const start = { x: d === 'r' ? x + w : x, y: y + (a ? clampY(a.y, h) : h / 2) };
        const gate = { x: d === 'r' ? cx + band[c].left : cx + band[c].right, y: cy + HEADER_Y };
        routes[c] = sideRoute(start, gate, { x: d === 'r' ? cx : cx + cs.w, y: cy + HEADER_Y }, d);
      } else {
        const start = { x: x + (a ? clampX((a.x0 + a.x1) / 2, w) : w / 2), y: d === 'u' ? y : y + h };
        routes[c] = verticalRoute(start, y + lane[c], { x: cx + cs.w / 2, y: d === 'u' ? cy + cs.h : cy }, d);
      }
      place(c, cx, cy);
    }
  };
  const root = size(state.root);
  place(state.root, -root.w / 2, -root.h / 2);
  return { pos, dir, routes };
}
