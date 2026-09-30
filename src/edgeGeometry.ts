// Геометрія ребер «Мапи» (ADR-0017). Маршрут рахує лейаут, а MapEdge лише малює його,
// тож тести перевіряють саме ту лінію, яку бачить користувач.

export type Box = { x: number; y: number; w: number; h: number };
export type Pt = { x: number; y: number };

/**
 * Елемент, з якого відкрили ціль, відносно лівого верхнього кута картки-джерела:
 * горизонтальний проміжок [x0, x1] і середина по висоті y.
 */
export type Anchor = { x0: number; x1: number; y: number };

/** Бік картки-батька, з якого стоїть дитина. */
export type Dir = 'r' | 'l' | 'u' | 'd';

export const opposite: Record<Dir, Dir> = { r: 'l', l: 'r', u: 'd', d: 'u' };

/** Правий бік у пріоритеті: його відстань до краю множиться на цей коефіцієнт. */
export const RIGHT_BIAS = 0.5;

/**
 * Куди виводити нову картку: до якого краю картки-джерела ближчий клікнутий елемент
 * (відстані нормовані на ширину/висоту). Правий бік у пріоритеті (RIGHT_BIAS);
 * без якоря (згорнута іконка, ще не виміряно) — праворуч.
 */
export function clickDir(anchor: Anchor | null | undefined, w: number, h: number): Dir {
  if (!anchor) return 'r';
  const cx = (anchor.x0 + anchor.x1) / 2 / w;
  const cy = anchor.y / h;
  const dist: [Dir, number][] = [
    ['r', (1 - cx) * RIGHT_BIAS],
    ['l', cx],
    ['u', cy],
    ['d', 1 - cy],
  ];
  return dist.reduce((best, cur) => (cur[1] < best[1] ? cur : best))[0];
}

/** Висота заголовка картки: бічні ребра заходять на цьому рівні (як хендли дерева, ADR-0004). */
export const HEADER_Y = 40;

export type Route = {
  /** SVG-шлях. */
  path: string;
  /** Ламана вздовж шляху — для перевірок. */
  line: Pt[];
  start: Pt;
  end: Pt;
  /** Напрям виходу з джерела (для «язичка»). */
  out: Pt;
  /** Зовнішня нормаль сторони цілі, в яку заходить ребро (для стрілки). */
  into: Pt;
  /** Точка для підпису. */
  mid: Pt;
};

const vec: Record<Dir, Pt> = { r: { x: 1, y: 0 }, l: { x: -1, y: 0 }, u: { x: 0, y: -1 }, d: { x: 0, y: 1 } };

function cubic(p0: Pt, p1: Pt, p2: Pt, p3: Pt, n = 16): Pt[] {
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n;
    const u = 1 - t;
    const k = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
    return { x: k[0] * p0.x + k[1] * p1.x + k[2] * p2.x + k[3] * p3.x, y: k[0] * p0.y + k[1] * p1.y + k[2] * p2.y + k[3] * p3.y };
  });
}

/**
 * Бічне ребро (r/l): з боку джерела на висоті рядка — кривою з горизонтальними дотичними через порожній
 * канал до межі смуги дитини `gate` (на рівні заголовка дитини), далі прямо до її боку.
 * Контрольні точки не далі за половину каналу — крива монотонна й лишається в каналі.
 */
export function sideRoute(start: Pt, gate: Pt, end: Pt, dir: 'r' | 'l'): Route {
  const s = dir === 'r' ? 1 : -1;
  const k = Math.min(160, Math.abs(gate.x - start.x) / 2);
  const c1 = { x: start.x + s * k, y: start.y };
  const c2 = { x: gate.x - s * k, y: gate.y };
  const curve = cubic(start, c1, c2, gate);
  const tail = gate.x === end.x ? '' : ` L${end.x},${end.y}`;
  return {
    path: `M${start.x},${start.y} C${c1.x},${c1.y} ${c2.x},${c2.y} ${gate.x},${gate.y}${tail}`,
    line: tail ? [...curve, end] : curve,
    start,
    end,
    out: vec[dir],
    into: vec[opposite[dir]],
    mid: curve[8],
  };
}

/**
 * Вертикальне ребро (u/d): з верху/низу джерела вертикально до своєї доріжки `laneY` у порожньому проміжку,
 * по ній горизонтально до x дитини, далі вертикально в її низ/верх. Кути заокруглені.
 */
export function verticalRoute(start: Pt, laneY: number, end: Pt, dir: 'u' | 'd'): Route {
  const dx = end.x - start.x;
  const r = Math.min(12, Math.abs(dx) / 2, Math.abs(laneY - start.y), Math.abs(end.y - laneY));
  const sx = Math.sign(dx);
  const sy = dir === 'u' ? -1 : 1;
  const a = { x: start.x, y: laneY };
  const b = { x: end.x, y: laneY };
  const path =
    r > 0
      ? `M${start.x},${start.y} L${a.x},${a.y - sy * r} Q${a.x},${a.y} ${a.x + sx * r},${a.y}` +
        ` L${b.x - sx * r},${b.y} Q${b.x},${b.y} ${b.x},${b.y + sy * r} L${end.x},${end.y}`
      : `M${start.x},${start.y} L${a.x},${a.y} L${b.x},${b.y} L${end.x},${end.y}`;
  return {
    path,
    line: [start, a, b, end],
    start,
    end,
    out: vec[dir],
    into: vec[opposite[dir]],
    mid: { x: (a.x + b.x) / 2, y: laneY },
  };
}

/** Чи перетинає відрізок прямокутник (Liang–Barsky). */
export function segmentHitsBox(a: Pt, b: Pt, r: Box): boolean {
  let t0 = 0;
  let t1 = 1;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const clip = (p: number, q: number) => {
    if (p === 0) return q >= 0;
    const t = q / p;
    if (p < 0) {
      if (t > t1) return false;
      if (t > t0) t0 = t;
    } else {
      if (t < t0) return false;
      if (t < t1) t1 = t;
    }
    return true;
  };
  return (
    clip(-dx, a.x - r.x) && clip(dx, r.x + r.w - a.x) && clip(-dy, a.y - r.y) && clip(dy, r.y + r.h - a.y) && t0 <= t1
  );
}

/** Чи проходить ламана крізь прямокутник. */
export function polylineHitsBox(line: Pt[], r: Box): boolean {
  for (let i = 1; i < line.length; i++) if (segmentHitsBox(line[i - 1], line[i], r)) return true;
  return false;
}
