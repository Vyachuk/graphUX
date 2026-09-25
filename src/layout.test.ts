import { describe, expect, it } from 'vitest';
import { registry } from './entities/registry';
import { buildGraph, COLLAPSED, ESTIMATE, expandedKeys, GAP, GAP_Y, heightKey } from './layout';
import { initialNav, navReducer, type NavAction } from './navigation';

const run = (...actions: NavAction[]) => actions.reduce(navReducer, initialNav);
const open = (from: string, type: 'person' | 'restaurant' | 'city' | 'dish', id: string, via = 'x'): NavAction =>
  ({ kind: 'open', from, ref: { type, id }, via });

// Ланцюжок: n0 people → n1 person → n2 restaurant → n3 dish → n4 person
const chain = run(open('n0', 'person', 'p1'), open('n1', 'restaurant', 'r1'), open('n2', 'dish', 'd1'), open('n3', 'person', 'p6'));
const pattern = (s: typeof chain) => {
  const e = expandedKeys(s);
  return Object.keys(s.nodes).map((k) => (e.has(k) ? '■' : '●')).join('');
};

describe('expandedKeys (ADR-0009, узагальнення ADR-0003)', () => {
  it('на ланцюжку — те саме правило ±1', () => {
    expect(pattern(chain)).toBe('●●●■■');
    expect(pattern(navReducer(chain, { kind: 'focus', key: 'n1' }))).toBe('■■■●●');
    expect(pattern(navReducer(chain, { kind: 'focus', key: 'n0' }))).toBe('■■●●●');
  });

  it('сестри фокуса розгорнуті, дідусь — ні', () => {
    // з Kanapa (n2) відкриваємо ще й місто → n5 під n3
    const s = navReducer(chain, open('n2', 'city', 'kyiv'));
    const e = expandedKeys(s);
    expect([...e].sort()).toEqual(['n2', 'n3', 'n5']);
    expect(e.has('n1')).toBe(false);
    expect(e.has('n4')).toBe(false);
  });
});

describe('buildGraph (ADR-0009)', () => {
  it('x — за колонками глибини, з найширшою нодою колонки', () => {
    const { nodes } = buildGraph(chain);
    const xs = nodes.map((n) => n.position.x);
    const step = COLLAPSED + GAP;
    expect(xs).toEqual([0, step, 2 * step, 3 * step, 3 * step + registry.dish.width + GAP]);
  });

  it('друга гілка з тієї ж ноди стоїть ПІД першою, з урахуванням виміряних висот', () => {
    const s = run(open('n0', 'person', 'p1'), open('n1', 'restaurant', 'r1'), open('n1', 'city', 'kyiv'));
    const heights = { [heightKey('n2', true)]: 500, [heightKey('n3', true)]: 300 };
    const g = buildGraph(s, heights);
    const pos = Object.fromEntries(g.nodes.map((n) => [n.id, n.position]));
    expect(pos.n2).toEqual({ x: pos.n3.x, y: 0 });
    expect(pos.n3.y).toBe(500 + GAP_Y);
    expect(g.edges.map((e) => `${e.source}->${e.target}`)).toEqual(['n0->n1', 'n1->n2', 'n1->n3']);
  });

  it('піддерево першої гілки відсуває другу гілку нижче', () => {
    // n1 має дві гілки; у першої (n2) теж дві дитини — друга гілка n1 має бути нижче за обидві
    const s = run(
      open('n0', 'person', 'p1'), open('n1', 'restaurant', 'r1'),
      open('n2', 'dish', 'd1'), open('n2', 'dish', 'd2'),
      open('n1', 'city', 'kyiv'),
    );
    const g = buildGraph(s);
    const y = Object.fromEntries(g.nodes.map((n) => [n.id, n.position.y]));
    const h = (k: string) => (g.expanded.has(k) ? ESTIMATE.expanded : ESTIMATE.collapsed);
    expect(y.n4).toBe(y.n3 + h('n3') + GAP_Y);
    expect(y.n5).toBe(Math.max(h('n2'), y.n4 + h('n4')) + GAP_Y);
  });

  it('complete лише коли всі висоти виміряні', () => {
    expect(buildGraph(chain).complete).toBe(false);
    const all = Object.fromEntries(Object.keys(chain.nodes).flatMap((k) => [[heightKey(k, true), 100], [heightKey(k, false), 80]]));
    expect(buildGraph(chain, all).complete).toBe(true);
  });

  it('активне ребро — те, що веде у фокус', () => {
    const { edges } = buildGraph(chain);
    expect(edges.filter((e) => e.data?.active).map((e) => e.target)).toEqual(['n4']);
  });
});
