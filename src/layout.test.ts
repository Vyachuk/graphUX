import { describe, expect, it } from 'vitest';
import { registry } from './entities/registry';
import { buildGraph, COLLAPSED, ESTIMATE, expandedKeys, FOCUS_WINDOW, GAP, GAP_Y, heightKey } from './layout';
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

describe('expandedKeys (ADR-0012: вікно з 4 карток)', () => {
  // довгий ланцюжок n0…n8
  const long = [['n4', 'dish', 'd1'], ['n5', 'person', 'p2'], ['n6', 'restaurant', 'r2'], ['n7', 'city', 'kyiv']].reduce(
    (s, [from, type, id]) => navReducer(s, open(from, type as 'dish', id)),
    chain,
  );
  const at = (key: string) => pattern(navReducer(long, { kind: 'focus', key }));

  it('завжди рівно 4 розгорнуті на ланцюжку', () => {
    expect(FOCUS_WINDOW).toBe(4);
    for (let i = 0; i <= 8; i++) expect(at(`n${i}`).split('■').length - 1).toBe(4);
  });

  it('йдеш уперед (фокус останній) — 3 назад + фокус', () => {
    expect(at('n8')).toBe('●●●●●■■■■');
  });

  it('посередині — 1 назад, фокус, 2 вперед', () => {
    expect(at('n4')).toBe('●●●■■■■●●');
  });

  it('біля кінця вікно добирає назад, біля кореня — вперед', () => {
    expect(at('n7')).toBe('●●●●●■■■■'); // n5 n6 назад, фокус n7, n8 вперед
    expect(at('n0')).toBe('■■■■●●●●●');
  });

  it('сестри й діти фокуса розгорнуті понад вікно', () => {
    // з Реберні на Узвозі (n2) відкриваємо ще й місто → n5, сестра n3
    const s = navReducer(chain, open('n2', 'city', 'kyiv'));
    const e = expandedKeys(s);
    expect([...e].sort()).toEqual(['n0', 'n1', 'n2', 'n3', 'n5']);
    expect(e.has('n4')).toBe(false);
  });

  it('камера наводиться лише на фокус — останню відкриту картку', () => {
    expect([...buildGraph(chain).camera]).toEqual(['n4']);
    const s = navReducer(chain, open('n4', 'city', 'kyiv'));
    expect([...buildGraph(s).camera]).toEqual([s.focus]);
    expect(s.focus).toBe('n5');
  });
});

describe('buildGraph (ADR-0009)', () => {
  it('x — за колонками глибини, з найширшою нодою колонки', () => {
    const { nodes } = buildGraph(chain);
    const xs = nodes.map((n) => n.position.x);
    // фокус n4: вікно n1–n4, n0 — іконка
    const x1 = COLLAPSED + GAP;
    const x2 = x1 + registry.person.width + GAP;
    const x3 = x2 + registry.restaurant.width + GAP;
    expect(xs).toEqual([0, x1, x2, x3, x3 + registry.dish.width + GAP]);
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
