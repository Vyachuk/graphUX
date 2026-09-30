import { describe, expect, it } from 'vitest';
import { registry } from './entities/registry';
import { clickDir, HEADER_Y, polylineHitsBox, type Anchor, type Dir } from './edgeGeometry';
import { buildGraph, CHANNEL, type Anchors, COLLAPSED, ESTIMATE, expandedKeys, FOCUS_WINDOW, GAP, GAP_Y, heightKey } from './layout';
import { seeded } from './seeded';
import { stressNav } from './stress';
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

describe('«Мапа» (ADR-0017)', () => {
  // Синтетичні якорі: елементи в різних місцях картки — ліва/права колонка, на всю ширину, вгорі/внизу.
  const setup = (count: number, seed: string) => {
    const s = stressNav(count);
    const rand = seeded(seed);
    const heights = Object.fromEntries(Object.keys(s.nodes).map((k) => [heightKey(k, true), 200 + rand() * 500]));
    const widths = Object.fromEntries(buildGraph(s, heights, 'tree').nodes.map((n) => [n.id, n.data.width]));
    const anchors: Anchors = {};
    for (const n of Object.values(s.nodes)) {
      if (!n.parent) continue;
      const w = widths[n.parent];
      const h = heights[heightKey(n.parent, true)];
      const col = Math.floor(rand() * 3); // 0 — ліва, 1 — права, 2 — на всю ширину
      anchors[n.key] = { x0: col === 1 ? w / 2 + 10 : 20, x1: col === 0 ? w / 2 - 10 : w - 20, y: 20 + rand() * (h - 40) };
    }
    const g = buildGraph(s, heights, 'map', anchors);
    const box = Object.fromEntries(
      g.nodes.map((n) => [n.id, { x: n.position.x, y: n.position.y, w: n.data.width, h: heights[heightKey(n.id, true)] }]),
    );
    return { s, g, box, anchors, heights, widths };
  };

  it.each([
    [100, 'a'],
    [150, 'b'],
    [200, 'c'],
    [200, 'd'],
  ])('%i карток (%s): картки не накладаються, жодне ребро не проходить під чужою карткою', (count, seed) => {
    const { g, box } = setup(count as number, seed as string);
    expect(g.complete).toBe(true);
    const bs = Object.entries(box);
    for (let i = 0; i < bs.length; i++)
      for (let j = i + 1; j < bs.length; j++) {
        const [a, b] = [bs[i][1], bs[j][1]];
        expect(a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h, `${bs[i][0]} × ${bs[j][0]}`).toBe(false);
      }
    for (const e of g.edges) {
      const line = e.data!.route!.line;
      for (const [id, b] of bs) {
        if (id === e.source || id === e.target) continue;
        expect(polylineHitsBox(line, b), `${e.id} під ${id}`).toBe(false);
      }
    }
  });

  it('усі чотири напрями трапляються, і дитина стоїть саме з того боку, де клікнули', () => {
    const { g, box, anchors } = setup(200, 'c');
    const seen = new Set<Dir>();
    for (const e of g.edges) {
      const [p, c] = [box[e.source], box[e.target]];
      const d = clickDir(anchors[e.target], p.w, p.h);
      expect(e.data!.dir).toBe(d);
      seen.add(d);
      if (d === 'r') expect(c.x).toBeGreaterThanOrEqual(p.x + p.w + CHANNEL - 0.01);
      if (d === 'l') expect(c.x + c.w).toBeLessThanOrEqual(p.x - CHANNEL + 0.01);
      if (d === 'u') expect(c.y + c.h).toBeLessThan(p.y);
      if (d === 'd') expect(c.y).toBeGreaterThan(p.y + p.h);
    }
    expect(seen).toEqual(new Set(['r', 'l', 'u', 'd']));
  });

  it('ребро стартує від клікнутого елемента: збоку на його висоті, згори/знизу — навпроти нього', () => {
    const { g, box, anchors } = setup(150, 'b');
    for (const e of g.edges) {
      const p = box[e.source];
      const a = anchors[e.target];
      const { start } = e.data!.route!;
      const d = e.data!.dir;
      if (d === 'r' || d === 'l') {
        expect(start.x).toBeCloseTo(d === 'r' ? p.x + p.w : p.x);
        expect(start.y).toBeCloseTo(p.y + Math.min(p.h - 8, Math.max(8, a.y)));
      } else {
        expect(start.y).toBeCloseTo(d === 'u' ? p.y : p.y + p.h);
        expect(start.x).toBeCloseTo(p.x + Math.min(p.w - 8, Math.max(8, (a.x0 + a.x1) / 2)));
      }
    }
  });

  it('єдина дитина з боку — її заголовок на висоті рядка, ребро горизонтальне', () => {
    const { s, g, box, anchors } = setup(100, 'a');
    let checked = 0;
    for (const n of Object.values(s.nodes)) {
      const right = n.children.filter((c) => g.edges.find((e) => e.target === c)!.data!.dir === 'r');
      if (right.length !== 1 || n.parent === null) continue;
      // Картка ліворуч від свого батька: справа в неї коридор для вхідного ребра — там діти відступають.
      if (g.edges.find((e) => e.target === n.key)!.data!.dir === 'l') continue;
      const c = right[0];
      expect(box[c].y + HEADER_Y).toBeCloseTo(box[n.key].y + Math.min(box[n.key].h - 8, anchors[c].y));
      checked++;
    }
    expect(checked).toBeGreaterThan(2);
  });

  it('без виміряних якорів розгорнутих батьків лейаут ще не complete', () => {
    const s = stressNav(100);
    const heights = Object.fromEntries(Object.keys(s.nodes).map((k) => [heightKey(k, true), 300]));
    expect(buildGraph(s, heights, 'map').complete).toBe(false);
    expect(buildGraph(s, heights, 'tree').complete).toBe(true);
  });
});

describe('clickDir', () => {
  const w = 600;
  const h = 800;
  const at = (x0: number, x1: number, y: number): Anchor => ({ x0, x1, y });
  it('права колонка — праворуч, ліва — ліворуч', () => {
    expect(clickDir(at(320, 580, 400), w, h)).toBe('r');
    expect(clickDir(at(20, 280, 400), w, h)).toBe('l');
  });
  it('на всю ширину посередині — праворуч (у пріоритеті)', () => {
    expect(clickDir(at(20, 580, 400), w, h)).toBe('r');
  });
  it('на всю ширину вгорі — згори, внизу — знизу', () => {
    expect(clickDir(at(20, 580, 60), w, h)).toBe('u');
    expect(clickDir(at(20, 580, 760), w, h)).toBe('d');
  });
  it('права колонка поблизу верху — все ще праворуч, крайній верх — згори', () => {
    expect(clickDir(at(320, 580, 160), w, h)).toBe('r');
    expect(clickDir(at(320, 580, 30), w, h)).toBe('u');
  });
  it('без якоря — праворуч', () => {
    expect(clickDir(null, w, h)).toBe('r');
  });
});

describe('картка-відповідь асистента (ADR-0018)', () => {
  it('не чекає на якір: лейаут complete, стоїть праворуч від батька', () => {
    const s = navReducer(initialNav, { kind: 'open', from: 'n0', ref: { type: 'assistant', id: 'a-test' }, via: '✦ AI' });
    const heights = { [heightKey('n0', true)]: 400, [heightKey('n1', true)]: 200 };
    const g = buildGraph(s, heights, 'map');
    expect(g.complete).toBe(true);
    const [root, card] = g.nodes;
    expect(card.position.x).toBeGreaterThan(root.position.x + root.data.width);
  });
});
