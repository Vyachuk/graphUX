// Фінансові мок-дані ресторанів (ADR-0008). Пʼяна вишня (r8) — цифри з макета Figma 638:4192.
import { getRestaurant, restaurants } from './data';

export type MetricKind = 'revenue' | 'expenses';
export type PeriodId = 'feb' | 'mar' | 'q2' | 'y2025';

export const QUARTER = 'Q1 2026';
export const MONTHS = ['Feb', 'Mar', 'Apr'] as const;

export const periods: { id: PeriodId; label: string }[] = [
  { id: 'feb', label: 'Лютий' },
  { id: 'mar', label: 'Березень' },
  { id: 'q2', label: 'Q2' },
  { id: 'y2025', label: '2025' },
];

export type MetricSnapshot = {
  total: number;
  /** Зміна до попереднього кварталу, %. */
  delta: number;
  /** Зміна в межах графіка, %. */
  trendDelta: number;
  trend: number[];
};

export type Breakdown = { label: string; share: number; color: string }[];

export type Financials = {
  restaurantId: string;
  revenue: MetricSnapshot;
  expenses: MetricSnapshot;
  breakdown: Breakdown;
  /** Значення виручки за інші періоди — для ноди порівняння. */
  history: Record<PeriodId, MetricSnapshot>;
};

const breakdown = (m: number, o: number, i: number): Breakdown => [
  { label: 'Marketing', share: m, color: '#818cf8' },
  { label: 'Operations', share: o, color: '#34d399' },
  { label: 'Infrastructure', share: i, color: '#f472b6' },
  { label: 'Other', share: 100 - m - o - i, color: '#fb923c' },
];

// Детермінований генератор, щоб цифри не стрибали між перезавантаженнями.
function seeded(seed: string) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

const round = (n: number, step = 50) => Math.round(n / step) * step;

function snapshot(rand: () => number, base: number, spread: number): MetricSnapshot {
  const trend = Array.from({ length: 7 }, (_, i) => base * (0.9 + 0.2 * Math.sin(i * 1.3 + rand() * 3) * spread + rand() * 0.05));
  return {
    total: round(base),
    delta: Math.round((rand() * 24 - 4) * 10) / 10,
    trendDelta: Math.round((rand() * 22 - 2) * 10) / 10,
    trend,
  };
}

function generate(restaurantId: string): Financials {
  const rand = seeded(restaurantId);
  const base = 90_000 + rand() * 140_000;
  const history = Object.fromEntries(
    periods.map((p) => [p.id, snapshot(rand, base * (0.8 + rand() * 0.3), 1)]),
  ) as Record<PeriodId, MetricSnapshot>;
  const m = 25 + Math.floor(rand() * 15);
  const o = 20 + Math.floor(rand() * 15);
  return {
    restaurantId,
    revenue: snapshot(rand, base, 1),
    expenses: snapshot(rand, base * (0.2 + rand() * 0.15), 1),
    breakdown: breakdown(m, o, Math.min(20, 100 - m - o - 5)),
    history,
  };
}

// Криві з макета: пік близько Feb, провал на Mar, підйом до Apr.
const designRevenueTrend = [0.62, 0.8, 0.9, 0.78, 0.62, 0.66, 0.84];
const designExpensesTrend = [0.72, 0.62, 0.55, 0.6, 0.78, 0.9, 0.95];

const overrides: Record<string, Financials> = {
  r8: {
    restaurantId: 'r8',
    revenue: { total: 181_900, delta: 14.2, trendDelta: 19.2, trend: designRevenueTrend },
    expenses: { total: 40_500, delta: 8.6, trendDelta: 3.6, trend: designExpensesTrend },
    breakdown: breakdown(35, 30, 20),
    history: {
      feb: { total: 169_950, delta: 9.2, trendDelta: 19.2, trend: [0.6, 0.72, 0.84, 0.9, 0.62, 0.64, 0.6] },
      mar: { total: 174_300, delta: 11.4, trendDelta: 12.1, trend: [0.55, 0.6, 0.7, 0.66, 0.74, 0.8, 0.78] },
      q2: { total: 158_200, delta: -3.1, trendDelta: 4.4, trend: [0.8, 0.74, 0.7, 0.66, 0.7, 0.68, 0.72] },
      y2025: { total: 612_400, delta: 22.5, trendDelta: 18.3, trend: [0.4, 0.5, 0.58, 0.64, 0.72, 0.8, 0.88] },
    },
  },
};

const cache = new Map<string, Financials>();

export function getFinancials(restaurantId: string): Financials {
  getRestaurant(restaurantId); // кидає, якщо ресторану немає
  let f = cache.get(restaurantId);
  if (!f) {
    f = overrides[restaurantId] ?? generate(restaurantId);
    cache.set(restaurantId, f);
  }
  return f;
}

export const allFinancials = () => restaurants.map((r) => getFinancials(r.id));

export const getPeriod = (id: string) => {
  const p = periods.find((x) => x.id === id);
  if (!p) throw new Error(`Unknown period: ${id}`);
  return p;
};

// id для навігації: metric = "r8.revenue", comparison = "r8.revenue.feb".
export const metricId = (restaurantId: string, kind: MetricKind) => `${restaurantId}.${kind}`;
export const comparisonId = (restaurantId: string, kind: MetricKind, period: PeriodId) =>
  `${restaurantId}.${kind}.${period}`;

export function parseMetricId(id: string) {
  const [restaurantId, kind, period] = id.split('.') as [string, MetricKind, PeriodId | undefined];
  if (kind !== 'revenue' && kind !== 'expenses') throw new Error(`Unknown metric: ${id}`);
  return { restaurantId, kind, period };
}

export const metricLabel: Record<MetricKind, { total: string; chart: string }> = {
  revenue: { total: 'Total Revenue', chart: 'Revenue' },
  expenses: { total: 'Total Expenses', chart: 'Expenses' },
};

export const usd = (n: number) => `$${n.toLocaleString('en-US')}`;
export const pct = (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(1)}%`;
