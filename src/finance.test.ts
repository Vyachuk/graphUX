import { describe, expect, it } from 'vitest';
import { restaurants } from './data';
import { registry } from './entities/registry';
import { allFinancials, comparisonId, getFinancials, metricId, parseMetricId, pct, periods, usd } from './finance';

describe('фінанси (ADR-0008)', () => {
  it('Пʼяна вишня має цифри з макета Figma 638:4192', () => {
    const f = getFinancials('r8');
    expect(usd(f.revenue.total)).toBe('$181,900');
    expect(f.revenue.delta).toBe(14.2);
    expect(pct(f.revenue.trendDelta)).toBe('+19.2%');
    expect(usd(f.expenses.total)).toBe('$40,500');
    expect(f.expenses.delta).toBe(8.6);
    expect(pct(f.expenses.trendDelta)).toBe('+3.6%');
    expect(f.breakdown.map((s) => [s.label, s.share])).toEqual([
      ['Marketing', 35], ['Operations', 30], ['Infrastructure', 20], ['Other', 15],
    ]);
    expect(usd(f.history.feb.total)).toBe('$169,950');
  });

  it('кожен ресторан має фінанси, частки витрат дають 100%, дані стабільні', () => {
    expect(allFinancials()).toHaveLength(restaurants.length);
    for (const f of allFinancials()) {
      expect(f.breakdown.reduce((s, x) => s + x.share, 0)).toBe(100);
      expect(f.breakdown.every((x) => x.share > 0)).toBe(true);
      expect(f.revenue.total).toBeGreaterThan(f.expenses.total);
      expect(Object.keys(f.history)).toEqual(periods.map((p) => p.id));
    }
    expect(getFinancials('r1')).toBe(getFinancials('r1'));
  });

  it('id показника і порівняння розбираються назад', () => {
    expect(parseMetricId(metricId('r8', 'revenue'))).toEqual({ restaurantId: 'r8', kind: 'revenue', period: undefined });
    expect(parseMetricId(comparisonId('r8', 'expenses', 'feb'))).toEqual({ restaurantId: 'r8', kind: 'expenses', period: 'feb' });
    expect(() => parseMetricId('r8.profit')).toThrow();
    expect(() => getFinancials('nope')).toThrow();
  });

  it('заголовки фінансових нод', () => {
    expect(registry.report.title('r8')).toBe('Financial Report Пʼяна вишня');
    expect(registry.report.subtitle?.('r8')).toBe('Q1 2026 Overview');
    expect(registry.metric.title('r8.revenue')).toBe('Revenue · Пʼяна вишня');
    expect(registry.comparison.title('r8.revenue.feb')).toBe('Revenue: Лютий vs Q1 2026');
  });
});
