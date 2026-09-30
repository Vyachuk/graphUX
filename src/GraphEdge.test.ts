import { describe, expect, it } from 'vitest';
import { segmentHitsBox, sideRoute, verticalRoute } from './edgeGeometry';
import { buildGraph } from './layout';
import { anchorId } from './navigation';
import { outgoing, stressNav } from './stress';

describe('маршрути ребер (ADR-0017)', () => {
  it('бічне: крива до воріт смуги, далі пряма в бік цілі; монотонне по x і y', () => {
    const r = sideRoute({ x: 0, y: 300 }, { x: 120, y: 40 }, { x: 400, y: 40 }, 'r');
    expect(r.line.at(-1)).toEqual({ x: 400, y: 40 });
    for (let i = 1; i < r.line.length; i++) {
      expect(r.line[i].x).toBeGreaterThanOrEqual(r.line[i - 1].x - 1e-9);
      expect(r.line[i].y).toBeLessThanOrEqual(r.line[i - 1].y + 1e-9);
    }
    expect(r.into).toEqual({ x: -1, y: 0 });
  });

  it('вертикальне: вгору до доріжки, вбік, вгору в низ цілі', () => {
    const r = verticalRoute({ x: 100, y: 0 }, -50, { x: 400, y: -150 }, 'u');
    expect(r.line).toEqual([{ x: 100, y: 0 }, { x: 100, y: -50 }, { x: 400, y: -50 }, { x: 400, y: -150 }]);
    expect(r.into).toEqual({ x: 0, y: 1 });
    expect(r.out).toEqual({ x: 0, y: -1 });
  });

  it('segmentHitsBox', () => {
    const b = { x: 10, y: 10, w: 10, h: 10 };
    expect(segmentHitsBox({ x: 0, y: 15 }, { x: 30, y: 15 }, b)).toBe(true);
    expect(segmentHitsBox({ x: 0, y: 0 }, { x: 30, y: 5 }, b)).toBe(false);
    expect(segmentHitsBox({ x: 0, y: 30 }, { x: 30, y: 0 }, b)).toBe(true);
  });
});

describe('якорі ребер', () => {
  it('кожне ребро знає id якоря на елементі, з якого відкрили ціль', () => {
    const s = stressNav(150);
    const g = buildGraph(s, {}, 'map');
    for (const e of g.edges) {
      const child = s.nodes[e.target];
      expect(e.data?.anchor).toBe(anchorId(child.ref, child.via));
      // той самий via, що й на картці-джерелі: інакше хендл не знайдеться
      expect(outgoing(s.nodes[e.source].ref).some((l) => anchorId(l.ref, l.via) === e.data?.anchor)).toBe(true);
    }
  });
});
